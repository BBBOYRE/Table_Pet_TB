param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"
$taskPrevious = @{}
$taskUtf8 = New-Object System.Text.UTF8Encoding($false)
try {
  while (-not (Test-Path -LiteralPath (Join-Path $Directory 'stop-gpu'))) {
    $taskMetrics = Join-Path $Directory 'metrics.jsonl'
    if (Test-Path -LiteralPath $taskMetrics) {
      $taskLatest = Get-Content -LiteralPath $taskMetrics -Tail 1 | ConvertFrom-Json
      $taskIds = @($taskLatest.processes | ForEach-Object { [string]$_.pid })
      $taskEngines = @{}
      foreach ($taskRow in (Get-CimInstance Win32_PerfRawData_GPUPerformanceCounters_GPUEngine)) {
        if ($taskRow.Name -notmatch '^pid_(\d+)_(.+)$' -or $Matches[1] -notin $taskIds) { continue }
        $taskKey = $Matches[2]
        $taskOld = $taskPrevious[$taskRow.Name]
        if ($taskOld -and $taskRow.Timestamp_Sys100NS -gt $taskOld.time) {
          $taskPercent = 100.0 * ([double]$taskRow.RunningTime - $taskOld.running) / ([double]$taskRow.Timestamp_Sys100NS - $taskOld.time)
          if ($taskPercent -ge 0) { $taskEngines[$taskKey] += $taskPercent }
        }
        $taskPrevious[$taskRow.Name] = @{ time = [double]$taskRow.Timestamp_Sys100NS; running = [double]$taskRow.RunningTime }
      }
      if ($taskEngines.Count -gt 0) {
        $taskRecord = @{ time = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); busiestEnginePercent = ($taskEngines.Values | Measure-Object -Maximum).Maximum; engines = $taskEngines } | ConvertTo-Json -Compress -Depth 4
        [IO.File]::AppendAllText((Join-Path $Directory 'gpu.jsonl'), $taskRecord + "`n", $taskUtf8)
      }
    }
    Start-Sleep -Seconds 10
  }
} catch {
  [IO.File]::WriteAllText((Join-Path $Directory 'gpu-error.txt'), $_.Exception.Message, $taskUtf8)
  exit 1
}

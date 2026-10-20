param([ValidateSet('official', 'mirror')][string]$Source = 'official')
$ErrorActionPreference = 'Stop'
# npm can inherit PowerShell 7's module path while invoking Windows PowerShell 5.1.
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPackage = Join-Path $taskRoot 'node_modules\electron'
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskPackage 'package.json') -Raw | ConvertFrom-Json).version
if ($taskVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Unsupported Electron version format.' }
$taskArchive = "electron-v$taskVersion-win32-x64.zip"
$taskZip = Join-Path $taskRoot ".local\tools\$taskArchive"
$taskExpected = (Get-Content -LiteralPath (Join-Path $taskPackage 'checksums.json') -Raw | ConvertFrom-Json).$taskArchive
if (-not $taskExpected) { throw 'Missing official checksum for the Windows x64 archive.' }
New-Item -ItemType Directory -Path (Split-Path $taskZip) -Force | Out-Null
if (-not (Test-Path -LiteralPath $taskZip)) {
  $taskUrl = if ($Source -eq 'mirror') { "https://npmmirror.com/mirrors/electron/$taskVersion/$taskArchive" } else { "https://github.com/electron/electron/releases/download/v$taskVersion/$taskArchive" }
  $taskPartial = "$taskZip.partial"
  Invoke-WebRequest -Uri $taskUrl -OutFile $taskPartial -UseBasicParsing -TimeoutSec 300
  if ((Get-FileHash -LiteralPath $taskPartial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected.ToLowerInvariant()) { throw 'Downloaded archive checksum mismatch. Nothing was installed.' }
  Move-Item -LiteralPath $taskPartial -Destination $taskZip -Force
}
$taskActual = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash
if ($taskActual.ToLowerInvariant() -ne $taskExpected.ToLowerInvariant()) { throw 'Electron archive checksum mismatch. The archive has not been extracted.' }
$taskDist = Join-Path $taskPackage 'dist'
Expand-Archive -LiteralPath $taskZip -DestinationPath $taskDist -Force
[IO.File]::WriteAllText((Join-Path $taskPackage 'path.txt'), 'electron.exe')
Write-Output "Electron $taskVersion Windows x64 installed; SHA-256 verified."

param([int]$X, [int]$Y, [string]$AllowedHandles, [int]$EndX = -1, [int]$EndY = -1)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TBPointer {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@
[TBPointer]::SetProcessDPIAware() | Out-Null
$taskOriginal = New-Object TBPointer+Point
[TBPointer]::GetCursorPos([ref]$taskOriginal) | Out-Null
$taskAllowed = $AllowedHandles.Split(',')
$taskPressed = $false
try {
  [TBPointer]::SetCursorPos($X, $Y) | Out-Null
  Start-Sleep -Milliseconds 400
  $taskPoint = New-Object TBPointer+Point
  [TBPointer]::GetCursorPos([ref]$taskPoint) | Out-Null
  if ([Math]::Abs($taskPoint.X - $X) -gt 2 -or [Math]::Abs($taskPoint.Y - $Y) -gt 2) { throw 'Cursor moved during the check. No click was sent; retry while the pointer is idle.' }
  $taskHandle = [TBPointer]::GetAncestor([TBPointer]::WindowFromPoint($taskPoint), 2).ToInt64().ToString()
  if ($taskHandle -notin $taskAllowed) { throw 'Pointer target is not one of this test application windows. No click was sent.' }
  [TBPointer]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
  $taskPressed = $true
  Start-Sleep -Milliseconds 100
  if ($EndX -ge 0 -and $EndY -ge 0) {
    for ($taskStep = 1; $taskStep -le 15; $taskStep++) {
      [TBPointer]::SetCursorPos([int]($X + ($EndX - $X) * $taskStep / 15), [int]($Y + ($EndY - $Y) * $taskStep / 15)) | Out-Null
      Start-Sleep -Milliseconds 25
    }
  }
  [TBPointer]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
  $taskPressed = $false
  Start-Sleep -Milliseconds 150
} finally {
  if ($taskPressed) { [TBPointer]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero) }
  [TBPointer]::SetCursorPos($taskOriginal.X, $taskOriginal.Y) | Out-Null
}

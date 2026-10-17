<#
.SYNOPSIS
    Stops the backend Node server process on port 5000.
.DESCRIPTION
    Reads .run/server.pid or identifies the Node process bound to port 5000, terminates it,
    cleans up PID file, and confirms port 5000 is released.
.PARAMETER Port
    Local server port (default: 5000).
#>
param (
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$pidFile = Join-Path $runDir "server.pid"

Write-Host "🛑 Stopping Realtime Canvas server..." -ForegroundColor Cyan

$stopped = $false

if (Test-Path $pidFile) {
    $pidVal = (Get-Content $pidFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($pidVal) {
        $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match "node") {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "   Terminated server process (PID: $($proc.Id))" -ForegroundColor Green
            $stopped = $true
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# Ensure port 5000 is released
$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($conn in $conns) {
        $p = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -match "node") {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Write-Host "   Released port $Port (PID: $($p.Id))" -ForegroundColor Green
            $stopped = $true
        }
    }
}

if ($stopped) {
    Write-Host "✅ Realtime Canvas server stopped cleanly." -ForegroundColor Green
} else {
    Write-Host "ℹ️  No active server process found on port $Port." -ForegroundColor Gray
}

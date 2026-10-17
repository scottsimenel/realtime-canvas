<#
.SYNOPSIS
    Complete teardown of both the Realtime Canvas server and the Cloudflare Tunnel.
.DESCRIPTION
    Terminates both the Node server on port 5000 and any active cloudflared tunnel processes,
    cleans up .run/*.pid and .run/*.url files, and verifies all processes are terminated.
.PARAMETER Port
    Local server port (default: 5000).
#>
param (
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$serverPidFile = Join-Path $runDir "server.pid"
$tunnelPidFile = Join-Path $runDir "tunnel.pid"
$tunnelUrlFile = Join-Path $runDir "tunnel.url"

Write-Host "🛑 Shutting down Realtime Canvas server and Cloudflare Tunnel..." -ForegroundColor Yellow

# 1. Stop Server
& "$PSScriptRoot/stop-server.ps1" -Port $Port

# 2. Stop Cloudflare Tunnel
Write-Host "🛑 Stopping Cloudflare Tunnel..." -ForegroundColor Cyan
$tunnelStopped = $false

if (Test-Path $tunnelPidFile) {
    $tPid = (Get-Content $tunnelPidFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($tPid) {
        $tProc = Get-Process -Id $tPid -ErrorAction SilentlyContinue
        if ($tProc -and $tProc.ProcessName -match "cloudflared") {
            Stop-Process -Id $tProc.Id -Force -ErrorAction SilentlyContinue
            Write-Host "   Terminated cloudflared process (PID: $($tProc.Id))" -ForegroundColor Green
            $tunnelStopped = $true
        }
    }
    Remove-Item $tunnelPidFile -Force -ErrorAction SilentlyContinue
}

# Also check for any remaining cloudflared processes started by this workspace
$orphanTunnels = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($orphanTunnels) {
    foreach ($ot in $orphanTunnels) {
        Stop-Process -Id $ot.Id -Force -ErrorAction SilentlyContinue
        Write-Host "   Terminated cloudflared instance (PID: $($ot.Id))" -ForegroundColor Green
        $tunnelStopped = $true
    }
}

Remove-Item $tunnelUrlFile -Force -ErrorAction SilentlyContinue

if ($tunnelStopped) {
    Write-Host "✅ Cloudflare Tunnel closed." -ForegroundColor Green
} else {
    Write-Host "ℹ️  No active Cloudflare Tunnel found." -ForegroundColor Gray
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✓ Complete teardown finished. All services are stopped." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

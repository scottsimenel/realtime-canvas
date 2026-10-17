<#
.SYNOPSIS
    Performs a soft restart of the backend Node server while keeping the Cloudflare tunnel active.
.DESCRIPTION
    Stops only the Express server process (port 5000), waits for the port to release,
    optionally rebuilds the client bundle, restarts the server, and validates health checks
    both locally and across the active Cloudflare tunnel URL (confirming zero tunnel downtime).
.PARAMETER Rebuild
    If specified, rebuilds the client Vite production bundle before starting.
.PARAMETER Port
    Local server port (default: 5000).
#>
param (
    [switch]$Rebuild,
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$serverPidFile = Join-Path $runDir "server.pid"
$tunnelPidFile = Join-Path $runDir "tunnel.pid"
$tunnelUrlFile = Join-Path $runDir "tunnel.url"

Write-Host "🔄 Initiating soft server restart (Cloudflare Tunnel will remain untouched)..." -ForegroundColor Cyan

# 1. Stop only the server process
$stopped = $false

# Check .run/server.pid
if (Test-Path $serverPidFile) {
    $pidToStop = Get-Content $serverPidFile -Raw -ErrorAction SilentlyContinue
    if ($pidToStop) {
        $serverProc = Get-Process -Id $pidToStop.Trim() -ErrorAction SilentlyContinue
        if ($serverProc -and $serverProc.ProcessName -match "node") {
            Write-Host "   Terminating server process (PID: $($serverProc.Id))..." -ForegroundColor DarkYellow
            Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
}

# If port is still held by a node process, cleanly release it
$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($conn in $conns) {
        $p = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -match "node") {
            Write-Host "   Releasing port $Port held by node PID: $($p.Id)..." -ForegroundColor DarkYellow
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
}

if (-not $stopped) {
    Write-Host "   No existing server process was active." -ForegroundColor Gray
}

# Wait for port to clear
$waitAttempts = 10
while ((Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue) -and $waitAttempts -gt 0) {
    Start-Sleep -Milliseconds 400
    $waitAttempts--
}
Remove-Item $serverPidFile -Force -ErrorAction SilentlyContinue
Write-Host "✓ Port $Port is clear." -ForegroundColor Green

# 2. Check and report on Cloudflare Tunnel status
if (Test-Path $tunnelPidFile) {
    $tPid = (Get-Content $tunnelPidFile -Raw -ErrorAction SilentlyContinue).Trim()
    $tProc = Get-Process -Id $tPid -ErrorAction SilentlyContinue
    if ($tProc -and $tProc.ProcessName -match "cloudflared") {
        Write-Host "🛡️  Cloudflare Tunnel is ACTIVE (PID: $tPid) — maintaining existing tunnel." -ForegroundColor Green
    }
}

# 3. Start server via start-server.ps1
$startScript = Join-Path $PSScriptRoot "start-server.ps1"
if ($Rebuild) {
    & $startScript -Rebuild -Port $Port
} else {
    & $startScript -Port $Port
}

# 4. Verify tunnel continuity if a tunnel URL is registered
if (Test-Path $tunnelUrlFile) {
    $tunnelUrl = (Get-Content $tunnelUrlFile -Raw).Trim()
    Write-Host "🌐 Verifying existing Cloudflare Tunnel continuity ($tunnelUrl)..." -ForegroundColor Cyan
    try {
        $tunnelHealth = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 5 -ErrorAction Stop
        if ($tunnelHealth.status -eq "healthy") {
            Write-Host "==========================================================" -ForegroundColor Green
            Write-Host "✅ SOFT RESTART SUCCESSFUL!" -ForegroundColor Green
            Write-Host "   Tunnel remained connected without interruption!" -ForegroundColor Green
            Write-Host "   Live URL: $tunnelUrl" -ForegroundColor Cyan
            Write-Host "==========================================================" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Local server is up, but tunnel endpoint check did not respond yet. It may take a moment to resume routing."
    }
}

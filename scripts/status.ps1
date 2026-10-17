<#
.SYNOPSIS
    Reports live runtime status of the Realtime Canvas server and Cloudflare Tunnel.
.DESCRIPTION
    Inspects process states, port 5000 bindings, /health endpoints locally and via
    the public tunnel URL, and displays a comprehensive health summary.
.PARAMETER Port
    Local server port (default: 5000).
#>
param (
    [int]$Port = 5000
)

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$serverPidFile = Join-Path $runDir "server.pid"
$tunnelPidFile = Join-Path $runDir "tunnel.pid"
$tunnelUrlFile = Join-Path $runDir "tunnel.url"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "📊 ANTIGRAVITY CANVAS RUNTIME STATUS" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Server Inspection
Write-Host "`n🖥️  Backend Server (Port $Port):" -ForegroundColor Yellow

$serverPid = $null
if (Test-Path $serverPidFile) {
    $serverPid = (Get-Content $serverPidFile -Raw -ErrorAction SilentlyContinue).Trim()
}

$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
    $procId = ($conns | Select-Object -ExpandProperty OwningProcess -Unique)[0]
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
    
    # Check local health
    $isHealthy = $false
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "healthy") { $isHealthy = $true }
    } catch {}

    if ($isHealthy) {
        Write-Host "   Status:      🟢 ONLINE & HEALTHY" -ForegroundColor Green
    } else {
        Write-Host "   Status:      🟡 LISTENING (unhealthy / responding with errors)" -ForegroundColor Yellow
    }
    Write-Host "   Process:     $procName (PID: $procId)" -ForegroundColor Gray
    Write-Host "   Local URL:   http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "   Health:      http://localhost:$Port/health" -ForegroundColor Cyan
    if ($proc) {
        $wsMb = [math]::Round($proc.WorkingSet64 / 1MB, 2)
        Write-Host "   Memory:      $wsMb MB" -ForegroundColor Gray
    }
} else {
    Write-Host "   Status:      🔴 OFFLINE (Port $Port is free)" -ForegroundColor Red
}

# 2. Cloudflare Tunnel Inspection
Write-Host "`n🌐 Cloudflare Tunnel:" -ForegroundColor Yellow

$tunnelPid = $null
if (Test-Path $tunnelPidFile) {
    $tunnelPid = (Get-Content $tunnelPidFile -Raw -ErrorAction SilentlyContinue).Trim()
}

$tunnelProc = $null
if ($tunnelPid) {
    $tunnelProc = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
}
if (-not $tunnelProc) {
    $tunnels = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($tunnels) {
        $tunnelProc = $tunnels[0]
    }
}

if ($tunnelProc) {
    Write-Host "   Status:      🟢 ACTIVE (PID: $($tunnelProc.Id))" -ForegroundColor Green
    
    $tunnelUrl = $null
    if (Test-Path $tunnelUrlFile) {
        $tunnelUrl = (Get-Content $tunnelUrlFile -Raw -ErrorAction SilentlyContinue).Trim()
    }

    if ($tunnelUrl) {
        Write-Host "   Public URL:  $tunnelUrl" -ForegroundColor Cyan
        
        # Test tunnel health
        try {
            $tHealth = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 4 -ErrorAction Stop
            if ($tHealth.status -eq "healthy") {
                Write-Host "   Connectivity: 🟢 Edge reachable and routing traffic" -ForegroundColor Green
            } else {
                Write-Host "   Connectivity: 🟡 Edge reachable, non-healthy response" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Connectivity: 🟡 Tunnel process running; edge test timed out" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Public URL:  (Check .run/tunnel.log for URL)" -ForegroundColor Gray
    }
} else {
    Write-Host "   Status:      🔴 STOPPED (No cloudflared process running)" -ForegroundColor Red
}

Write-Host "`n==========================================================" -ForegroundColor Cyan

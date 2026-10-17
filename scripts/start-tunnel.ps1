<#
.SYNOPSIS
    Starts a Cloudflare Quick Tunnel forwarding to http://localhost:5000 in the background.
.DESCRIPTION
    Locates the cloudflared executable, verifies the server is running, launches the tunnel
    as a background process, extracts the assigned trycloudflare.com URL from the output log,
    and saves the URL to .run/tunnel.url for persistent tracking.
.PARAMETER Port
    Local port to tunnel (defaults to 5000).
#>
param (
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$tunnelPidFile = Join-Path $runDir "tunnel.pid"
$tunnelLogFile = Join-Path $runDir "tunnel.log"
$tunnelUrlFile = Join-Path $runDir "tunnel.url"

if (-not (Test-Path $runDir)) {
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

# Check if tunnel is already running
if (Test-Path $tunnelPidFile) {
    $existingPid = Get-Content $tunnelPidFile -Raw
    $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -match "cloudflared") {
        Write-Host "✅ Cloudflare Tunnel is ALREADY running (PID: $($proc.Id))" -ForegroundColor Green
        if (Test-Path $tunnelUrlFile) {
            $existingUrl = (Get-Content $tunnelUrlFile -Raw).Trim()
            Write-Host "   Public URL: $existingUrl" -ForegroundColor Cyan
        }
        exit 0
    }
}

# Locate cloudflared binary
$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
$cloudflaredPath = $null

if ($cloudflaredCmd) {
    $cloudflaredPath = $cloudflaredCmd.Source
} else {
    $searchPaths = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe",
        "$env:LOCALAPPDATA\Programs\cloudflared\cloudflared.exe",
        "$env:USERPROFILE\bin\cloudflared.exe"
    )
    foreach ($candidate in $searchPaths) {
        if (Test-Path $candidate) {
            $cloudflaredPath = $candidate
            break
        }
    }
}

if (-not $cloudflaredPath) {
    Write-Error "cloudflared executable was not found. Please download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
}

Write-Host "🔍 Found cloudflared at: $cloudflaredPath" -ForegroundColor Gray

# Check that the local server is reachable
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction Stop
    if ($health.status -ne "healthy") {
        Write-Warning "Local server is running on port $Port but did not respond with healthy status."
    }
} catch {
    Write-Warning "Local server on port $Port does not appear to be running yet. (You can run ./scripts/start-server.ps1)"
}

Write-Host "🌐 Launching Cloudflare Tunnel forwarding to http://localhost:$Port..." -ForegroundColor Cyan

# Clear old tunnel log
if (Test-Path $tunnelLogFile) {
    Remove-Item $tunnelLogFile -Force -ErrorAction SilentlyContinue
}

# Launch cloudflared process
$proc = Start-Process -FilePath $cloudflaredPath `
    -ArgumentList "tunnel --url http://localhost:$Port" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $tunnelLogFile `
    -RedirectStandardError (Join-Path $runDir "tunnel.err.log") `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $tunnelPidFile -Value $proc.Id -Force
Write-Host "   Tunnel process started with PID: $($proc.Id)" -ForegroundColor DarkCyan

# Parse assigned trycloudflare.com URL
$tunnelUrl = $null
$maxWait = 30
$elapsed = 0
Write-Host "⏳ Establishing tunnel connection to Cloudflare edge..." -NoNewline

while ($elapsed -lt $maxWait -and -not $tunnelUrl) {
    Start-Sleep -Seconds 1
    $elapsed++
    Write-Host "." -NoNewline

    if (Test-Path $tunnelLogFile) {
        $logContent = Get-Content $tunnelLogFile -Raw -ErrorAction SilentlyContinue
        if ($logContent -match "https://[a-zA-Z0-9\-]+\.trycloudflare\.com") {
            $tunnelUrl = $matches[0]
        }
    }
}
Write-Host ""

if ($tunnelUrl) {
    Set-Content -Path $tunnelUrlFile -Value $tunnelUrl -Force
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "🎉 Cloudflare Tunnel is LIVE!" -ForegroundColor Green
    Write-Host "   Public URL:   $tunnelUrl" -ForegroundColor Cyan
    Write-Host "   Local Origin: http://localhost:$Port" -ForegroundColor Gray
    Write-Host "   Health Check: $tunnelUrl/health" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Warning "Tunnel started (PID: $($proc.Id)), but could not parse URL automatically within $maxWait seconds."
    Write-Host "Check $tunnelLogFile for details." -ForegroundColor Gray
}

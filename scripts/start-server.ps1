<#
.SYNOPSIS
    Starts the Antigravity Canvas production Express server on port 5000 in the background.
.DESCRIPTION
    Checks for Node.js, ensures the client bundle (client/dist) is built, starts server/server.js
    in the background, saves the process ID to .run/server.pid, and verifies the /health endpoint.
.PARAMETER Rebuild
    If specified, forces a fresh rebuild of the client Vite assets before starting.
.PARAMETER Port
    Override default port 5000.
#>
param (
    [switch]$Rebuild,
    [int]$Port = 5000
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$runDir = Join-Path $repoRoot ".run"
$pidFile = Join-Path $runDir "server.pid"
$logFile = Join-Path $runDir "server.log"
$clientDist = Join-Path $repoRoot "client/dist"

if (-not (Test-Path $runDir)) {
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

# Ensure Node and npm are available in PATH
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command fnm -ErrorAction SilentlyContinue) {
        fnm env | Out-String | Invoke-Expression
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js executable was not found. Please ensure Node.js is installed."
    exit 1
}

# Check if port is already in use
$existingConn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($existingConn) {
    # Check if existing process responds to /health
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction Stop
        if ($health.status -eq "healthy") {
            Write-Host "✅ Realtime Canvas server is ALREADY running on http://localhost:$Port" -ForegroundColor Green
            if (Test-Path $pidFile) {
                $runningPid = Get-Content $pidFile -Raw
                Write-Host "   Server PID: $runningPid" -ForegroundColor Cyan
            }
            exit 0
        }
    } catch {
        Write-Warning "Port $Port is occupied by another process that is not responding to /health."
    }
}

# Build client if missing or if -Rebuild specified
if ($Rebuild -or (-not (Test-Path $clientDist))) {
    Write-Host "📦 Building React client production bundle..." -ForegroundColor Yellow
    npm --prefix "$repoRoot/client" run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Client build failed. Server startup aborted."
        exit 1
    }
    Write-Host "✓ Client bundle compiled successfully." -ForegroundColor Green
}

Write-Host "🚀 Launching Realtime Canvas server on port $Port..." -ForegroundColor Cyan

# Start node process in background
$env:PORT = $Port
$proc = Start-Process -FilePath "node" `
    -ArgumentList "server/server.js" `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError (Join-Path $runDir "server.err.log") `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $pidFile -Value $proc.Id -Force
Write-Host "   Server process started with PID: $($proc.Id)" -ForegroundColor DarkCyan

# Verify health endpoint
$maxAttempts = 15
$attempt = 0
$isHealthy = $false

Write-Host "⏳ Waiting for health check verification..." -NoNewline
while ($attempt -lt $maxAttempts -and -not $isHealthy) {
    Start-Sleep -Milliseconds 600
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "healthy") {
            $isHealthy = $true
        }
    } catch {
        $attempt++
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if ($isHealthy) {
    Write-Host "✅ Realtime Canvas server is active and healthy!" -ForegroundColor Green
    Write-Host "   Local URL:    http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "   Health Check: http://localhost:$Port/health" -ForegroundColor Cyan
    Write-Host "   Server Log:   $logFile" -ForegroundColor Gray
} else {
    Write-Error "Server failed health check after $maxAttempts attempts. Check logs at: $logFile"
    exit 1
}

#!/usr/bin/env bash
# Starts a Cloudflare Quick Tunnel forwarding to http://localhost:5000 in background.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
PID_FILE="$RUN_DIR/tunnel.pid"
LOG_FILE="$RUN_DIR/tunnel.log"
URL_FILE="$RUN_DIR/tunnel.url"
PORT="${PORT:-5000}"

mkdir -p "$RUN_DIR"

if [ -f "$PID_FILE" ]; then
  EXISTING_PID=$(cat "$PID_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "✅ Cloudflare Tunnel is ALREADY running (PID: $EXISTING_PID)"
    if [ -f "$URL_FILE" ]; then
      echo "   Public URL: $(cat "$URL_FILE")"
    fi
    exit 0
  fi
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Error: cloudflared command not found in PATH." >&2
  exit 1
fi

echo "🌐 Launching Cloudflare Tunnel forwarding to http://localhost:$PORT..."
rm -f "$LOG_FILE"

nohup cloudflared tunnel --url "http://localhost:$PORT" > "$LOG_FILE" 2>&1 &
TUNNEL_PID=$!
echo "$TUNNEL_PID" > "$PID_FILE"
echo "   Tunnel process started with PID: $TUNNEL_PID"

echo -n "⏳ Establishing tunnel connection to Cloudflare edge..."
MAX_WAIT=30
ELAPSED=0
TUNNEL_URL=""

while [ $ELAPSED -lt $MAX_WAIT ] && [ -z "$TUNNEL_URL" ]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  echo -n "."
  if [ -f "$LOG_FILE" ]; then
    TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' "$LOG_FILE" | head -n 1 || true)
  fi
done
echo ""

if [ -n "$TUNNEL_URL" ]; then
  echo "$TUNNEL_URL" > "$URL_FILE"
  echo "=========================================================="
  echo "🎉 Cloudflare Tunnel is LIVE!"
  echo "   Public URL:   $TUNNEL_URL"
  echo "   Local Origin: http://localhost:$PORT"
  echo "   Health Check: $TUNNEL_URL/health"
  echo "=========================================================="
else
  echo "Warning: Tunnel started (PID: $TUNNEL_PID), but could not detect URL within $MAX_WAIT seconds."
  echo "Check $LOG_FILE for details."
fi

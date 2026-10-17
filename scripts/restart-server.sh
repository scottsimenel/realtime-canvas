#!/usr/bin/env bash
# Soft-restarts the backend Node server while keeping Cloudflare tunnel intact.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
TUNNEL_URL_FILE="$RUN_DIR/tunnel.url"
PORT="${PORT:-5000}"
REBUILD=false

for arg in "$@"; do
  case $arg in
    --rebuild|-r)
      REBUILD=true
      shift
      ;;
  esac
done

echo "🔄 Initiating soft server restart (Cloudflare Tunnel will remain untouched)..."

# 1. Stop only server process
if [ -f "$SERVER_PID_FILE" ]; then
  OLD_PID=$(cat "$SERVER_PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "   Terminating server process (PID: $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$OLD_PID" 2>/dev/null; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$SERVER_PID_FILE"
fi

# Fallback: check if anything is listening on port 5000
if command -v lsof >/dev/null 2>&1; then
  PORT_PID=$(lsof -ti :"$PORT" || true)
  if [ -n "$PORT_PID" ]; then
    echo "   Clearing port $PORT held by PID $PORT_PID..."
    kill -9 $PORT_PID 2>/dev/null || true
  fi
fi

echo "✓ Port $PORT is clear."

# 2. Check and report on Cloudflare Tunnel status
if [ -f "$TUNNEL_PID_FILE" ]; then
  TUNNEL_PID=$(cat "$TUNNEL_PID_FILE")
  if kill -0 "$TUNNEL_PID" 2>/dev/null; then
    echo "🛡️  Cloudflare Tunnel is ACTIVE (PID: $TUNNEL_PID) — maintaining existing tunnel."
  fi
fi

# 3. Start server
START_FLAGS=()
if [ "$REBUILD" = true ]; then
  START_FLAGS+=("--rebuild")
fi

PORT="$PORT" "$REPO_ROOT/scripts/start-server.sh" "${START_FLAGS[@]}"

# 4. Verify tunnel continuity if registered
if [ -f "$TUNNEL_URL_FILE" ]; then
  TUNNEL_URL=$(cat "$TUNNEL_URL_FILE")
  echo "🌐 Verifying existing Cloudflare Tunnel continuity ($TUNNEL_URL)..."
  sleep 1
  if curl -s -f "$TUNNEL_URL/health" >/dev/null 2>&1; then
    echo "=========================================================="
    echo "✅ SOFT RESTART SUCCESSFUL!"
    echo "   Tunnel remained connected without interruption!"
    echo "   Live URL: $TUNNEL_URL"
    echo "=========================================================="
  else
    echo "Warning: Local server restarted, but tunnel health check timed out. Edge may be reconnecting."
  fi
fi

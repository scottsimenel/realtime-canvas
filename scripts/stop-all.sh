#!/usr/bin/env bash
# Complete teardown of both the Realtime Canvas server and Cloudflare Tunnel.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
TUNNEL_URL_FILE="$RUN_DIR/tunnel.url"
PORT="${PORT:-5000}"

echo "🛑 Shutting down Realtime Canvas server and Cloudflare Tunnel..."

# 1. Stop Server
"$REPO_ROOT/scripts/stop-server.sh"

# 2. Stop Tunnel
echo "🛑 Stopping Cloudflare Tunnel..."
if [ -f "$TUNNEL_PID_FILE" ]; then
  TUNNEL_PID=$(cat "$TUNNEL_PID_FILE")
  if kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
    echo "   Terminated cloudflared process (PID: $TUNNEL_PID)"
  fi
  rm -f "$TUNNEL_PID_FILE"
fi

# Fallback: kill any lingering cloudflared processes
pkill -f "cloudflared tunnel" 2>/dev/null || true
rm -f "$TUNNEL_URL_FILE"

echo "=========================================================="
echo "✓ Complete teardown finished. All services are stopped."
echo "=========================================================="

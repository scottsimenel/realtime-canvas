#!/usr/bin/env bash
# Reports live runtime status of Realtime Canvas server and Cloudflare Tunnel.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
TUNNEL_URL_FILE="$RUN_DIR/tunnel.url"
PORT="${PORT:-5000}"

echo "=========================================================="
echo "📊 ANTIGRAVITY CANVAS RUNTIME STATUS"
echo "=========================================================="

echo ""
echo "🖥️  Backend Server (Port $PORT):"
if curl -s -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "   Status:      🟢 ONLINE & HEALTHY"
  echo "   Local URL:   http://localhost:$PORT"
  echo "   Health:      http://localhost:$PORT/health"
  if [ -f "$SERVER_PID_FILE" ]; then
    echo "   Process PID: $(cat "$SERVER_PID_FILE")"
  fi
else
  echo "   Status:      🔴 OFFLINE"
fi

echo ""
echo "🌐 Cloudflare Tunnel:"
if pgrep -f "cloudflared tunnel" >/dev/null 2>&1; then
  TUNNEL_PID=$(pgrep -f "cloudflared tunnel" | head -n 1)
  echo "   Status:      🟢 ACTIVE (PID: $TUNNEL_PID)"
  if [ -f "$TUNNEL_URL_FILE" ]; then
    TUNNEL_URL=$(cat "$TUNNEL_URL_FILE")
    echo "   Public URL:  $TUNNEL_URL"
    if curl -s -f "$TUNNEL_URL/health" >/dev/null 2>&1; then
      echo "   Connectivity: 🟢 Edge reachable and routing traffic"
    else
      echo "   Connectivity: 🟡 Edge reachable, waiting for route"
    fi
  fi
else
  echo "   Status:      🔴 STOPPED"
fi

echo ""
echo "=========================================================="

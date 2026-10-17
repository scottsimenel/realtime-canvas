#!/usr/bin/env bash
# Stops the backend Node server process on port 5000.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
PID_FILE="$RUN_DIR/server.pid"
PORT="${PORT:-5000}"

echo "🛑 Stopping Realtime Canvas server..."
STOPPED=false

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    sleep 0.5
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "   Terminated server process (PID: $PID)"
    STOPPED=true
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  PORT_PID=$(lsof -ti :"$PORT" || true)
  if [ -n "$PORT_PID" ]; then
    kill -9 "$PORT_PID" 2>/dev/null || true
    echo "   Released port $PORT (PID: $PORT_PID)"
    STOPPED=true
  fi
fi

if [ "$STOPPED" = true ]; then
  echo "✅ Realtime Canvas server stopped cleanly."
else
  echo "ℹ️  No active server process found on port $PORT."
fi

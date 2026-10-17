#!/usr/bin/env bash
# Starts the Antigravity Canvas production Express server on port 5000 in background.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
PID_FILE="$RUN_DIR/server.pid"
LOG_FILE="$RUN_DIR/server.log"
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

mkdir -p "$RUN_DIR"

# Verify Node.js is installed
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node command not found." >&2
  exit 1
fi

# Check if server is already running
if curl -s -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "✅ Realtime Canvas server is ALREADY running on http://localhost:$PORT"
  if [ -f "$PID_FILE" ]; then
    echo "   Server PID: $(cat "$PID_FILE")"
  fi
  exit 0
fi

# Build client if requested or missing
if [ "$REBUILD" = true ] || [ ! -d "$REPO_ROOT/client/dist" ]; then
  echo "📦 Building React client production bundle..."
  (cd "$REPO_ROOT/client" && npm run build)
  echo "✓ Client bundle compiled successfully."
fi

echo "🚀 Launching Realtime Canvas server on port $PORT..."
PORT="$PORT" nohup node "$REPO_ROOT/server/server.js" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "   Server process started with PID: $SERVER_PID"

echo -n "⏳ Waiting for health check verification..."
MAX_ATTEMPTS=15
ATTEMPT=0
HEALTHY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$HEALTHY" = false ]; do
  sleep 0.6
  if curl -s -f "http://localhost:$PORT/health" >/dev/null 2>&1; then
    HEALTHY=true
  else
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
  fi
done
echo ""

if [ "$HEALTHY" = true ]; then
  echo "✅ Realtime Canvas server is active and healthy!"
  echo "   Local URL:    http://localhost:$PORT"
  echo "   Health Check: http://localhost:$PORT/health"
  echo "   Server Log:   $LOG_FILE"
else
  echo "❌ Server failed health check after $MAX_ATTEMPTS attempts. Check $LOG_FILE" >&2
  exit 1
fi

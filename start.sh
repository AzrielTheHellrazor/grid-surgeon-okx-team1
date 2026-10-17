#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "======================================================================"
echo "⚡ GRID-SURGEON // UNBREAKABLE 4-BORDER PIPELINE LAUNCHER"
echo "   Backend API : http://localhost:4001"
echo "   Command UI  : http://localhost:5173"
echo "======================================================================"

# Auto-install dependencies if missing
if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
  echo "[1/3] Installing backend dependencies..."
  npm install --prefix "$ROOT_DIR/backend"
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "[2/3] Installing frontend dependencies..."
  npm install --prefix "$ROOT_DIR/frontend"
fi

# Clean up any stale processes on ports 4001 or 5173
lsof -ti:4001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down Grid-Surgeon Backend (:4001) and Frontend (:5173)..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "[1/2] Starting Unbreakable 4-Border Pipeline Backend on port 4001..."
npm run dev --prefix "$ROOT_DIR/backend" &
BACKEND_PID=$!

sleep 2

echo "[2/2] Starting 4-Quadrant Command Center UI on port 5173..."
npm run dev --prefix "$ROOT_DIR/frontend" &
FRONTEND_PID=$!

wait

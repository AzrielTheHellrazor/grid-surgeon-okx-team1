#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=================================================================="
echo "  GRID-SURGEON — UNBREAKABLE 4-BORDER PIPELINE & SECURITY DOCTOR  "
echo "=================================================================="

echo "[1/4] Verifying OKX Agent Trade Kit CLI binary..."
command -v okx >/dev/null 2>&1 || { echo "Installing @okx_ai/okx-trade-cli..."; npm install -g @okx_ai/okx-trade-cli; }
okx --version

echo "[2/4] Running Quantitative Math & Edge-Case Stress Audit (23 Suites + 1,000 Monte Carlo)..."
node scripts/verify-quant-math.mjs

echo "[3/4] Running Avalanche C-Chain Smart Contract & EIP-191 Signature Audit..."
node scripts/verify-avalanche-contract.mjs

echo "[4/4] Building TypeScript Backend + Vite 4-Quadrant Command Center Frontend..."
npm run build

echo "=================================================================="
echo "  ALL 4 PIPELINE BORDERS, QUANT MATH, AVALANCHE ABI & BUILDS OK!  "
echo "=================================================================="

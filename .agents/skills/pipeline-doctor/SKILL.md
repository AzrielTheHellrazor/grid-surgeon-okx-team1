---
name: pipeline-doctor
description: Automated diagnostics, border contract verification, and self-healing repair workflow for Grid-Surgeon. Activate whenever building features, testing the 4-border pipeline, preparing for the live hackathon demo, or troubleshooting any backend/frontend issue.
---

# Grid-Surgeon Pipeline Doctor Skill

Use this skill to verify and self-heal all 4 borders of the **Grid-Surgeon** pipeline without requiring any manual action from the user.

## Step 1 — Verify Environment & Binaries
Run these checks automatically:
```bash
which node npm okx
okx --version
```
If `okx` is missing, install it automatically via `npm install -g @okx_ai/okx-trade-cli && okx auth install`.

## Step 2 — Compile & Type-Check Both Ends
```bash
npm run build
```
If TypeScript or Vite reports any error, fix the offending file immediately and re-run `npm run build` until exit code is `0`.

## Step 3 — Verify All 4 Pipeline Borders & Stage Scenarios
Start the backend on port `4001` (if not already running) and verify every border and scenario endpoint returns HTTP 200 with valid JSON (`border1`, `border2`, `border3`, `border4`):
1. `GET http://localhost:4001/api/status` — Must return full state, wallet address, and health status.
2. `POST http://localhost:4001/api/cycle` (`{"scenario":"LIVE"}`) — Must pull live `AVAX-USDT-SWAP` data from `okx` CLI and return all 4 border outputs.
3. `POST http://localhost:4001/api/cycle` (`{"scenario":"GRID_DRIFT"}`) — Must trigger `SURGERY_AMEND_GRID` (`okx bot grid amend`).
4. `POST http://localhost:4001/api/cycle` (`{"scenario":"BULL_TRAP"}`) — Must trigger `BULL_TRAP_SHORT` ($D_{\text{trap}} > 1.10$), stop grid, and open counter-trap swap + trailing stop.
5. `POST http://localhost:4001/api/cycle` (`{"scenario":"PROFIT_SWEEP"}`) — Must sweep 50% of profit via `okx account transfer` and `okx earn savings purchase`.
6. `POST http://localhost:4001/api/cycle` (`{"scenario":"MACRO_BUNKER"}`) — Must trigger `MACRO_BUNKER` mode.

## Step 4 — Security & Git Hygiene Check
Before committing:
1. Confirm `.gitignore` excludes `node_modules/`, `dist/`, `.env*`, and `.data/`.
2. Confirm `git status --short` shows zero private key or `.data/` files staged.
3. Commit and push to `origin main`.

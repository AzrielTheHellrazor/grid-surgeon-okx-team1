# Grid-Surgeon — Agent Rules & Multi-Agent Workflow Contract

## 1. Vibecoder Zero-Touch Policy (MANDATORY)
The owner of this repository is a **vibecoder** who will **never** read code, edit `.env` files manually, or debug stack traces by hand. Every agent operating in this workspace MUST follow these rules unconditionally:
- **Never ask the user to edit a file, run a complex debugging command, or fix a build error manually.** Fix it yourself, verify it end-to-end, and only present working results.
- **Single-Command Launch:** `./start.sh` (or `npm start`) at the repository root must always launch both the Backend (`http://localhost:4001`) and Frontend (`http://localhost:5173`) without requiring manual setup.
- **Self-Verification Before Completion:** Before claiming any change is finished, run `npm run build` and test the live pipeline borders via `./verify-pipelines.sh` (or `curl http://localhost:4001/api/status`).

---

## 2. Unbreakable 4-Border Pipeline Architecture
All features and changes must preserve the strict 4-Border data contract. No border is ever allowed to throw an unhandled exception or return `undefined`/`NaN`:

| Border | Module | Input | Output Contract | Fallback Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Border 1: SENSE** | `backend/src/pipeline/phase1Sense.ts` | Symbol (`AVAX-USDT-SWAP`) + Optional Scenario Override | `Phase1SensorOutput` (Price, Candles, RSI, BB, ADX, ATR, Funding, OI-History, Sentiment, SmartMoney) | Uses live `okx` CLI public endpoints; deterministically computes ADX/ATR/RSI/BB from candles if indicator CLI is empty; derives sentiment/whale positioning from live OI & funding if OAuth is not logged in. |
| **Border 2: BRAIN** | `backend/src/pipeline/phase2Brain.ts` | `Phase1SensorOutput` + Active Bot State | `Phase2BrainOutput` (Regime enum, $D_{\text{trap}}$ score, Grid Surgery parameters, Liquidation Price, Reasoning bullets) | Pure deterministic math; clamps all ratios and checks `isFinite()` on every number so `NaN` can never cross Border 2. |
| **Border 3: EXECUTE** | `backend/src/pipeline/phase3Execute.ts` | `Phase2BrainOutput` | `Phase3ExecuteOutput` (CLI commands run, Active Grid/Swap/DCA state, High-Water Mark Simple Earn sweep receipt) | Executes live `okx` CLI writes when authenticated; automatically falls back to deterministic `DEMO_SIMULATION` receipts when unauthenticated or in demo mode. |
| **Border 4: ANCHOR** | `backend/src/pipeline/phase4Anchor.ts` | `Phase1` + `Phase2` + `Phase3` | `Phase4AnchorOutput` (`keccak256` reasoningHash, EIP-191 signature, `GridSurgeonRegistry.sol` encoded calldata, optional TX hash) | Auto-generates & persists an operator burner wallet in `.data/avalanche-wallet.json`; produces real cryptographic hashes & signatures offline and broadcasts to Avalanche Fuji/C-Chain when funded. |

---

## 3. Multi-Agent Role Division (For Antigravity IDE & CLI)
When working on complex changes in this repository, divide work across specialized subagents:
1. **Builder Agent (`self`)**: Implements backend pipeline modules (`port 4001`) and frontend 4-Quadrant UI components (`port 5173`).
2. **Pipeline & Border QA Agent (`pipeline-border-qa`)**: Runs `./verify-pipelines.sh`, tests all 5 stage scenario triggers (`LIVE`, `GRID_DRIFT`, `BULL_TRAP`, `PROFIT_SWEEP`, `MACRO_BUNKER`), and verifies JSON schema alignment between backend and frontend.
3. **Security & Git Auditor (`security-git-auditor`)**: Verifies `.gitignore` blocks `.env*` and `.data/*wallet*.json`, ensures `okx` CLI execution uses safe timeouts and sanitized arguments, checks `contracts/GridSurgeonRegistry.sol` ABI parity, and pushes clean commits to `origin main`.

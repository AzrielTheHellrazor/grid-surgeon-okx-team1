# 🎯 GRID-SURGEON // 10-MINUTE STAGE DEMO PLAYBOOK (ANKARA HACKATHON)

> **Autonomous Self-Healing OKX Grid Orchestrator, Whale-Divergence Trap Hunter & Avalanche C-Chain Cryptographic Proof Registry (`AVAX-USDT-SWAP`)**

---

## ⚡ 1. Pre-Stage 30-Second Flight Check

1. **Start or Verify Services:**
   ```bash
   ./start.sh
   ```
   - **Frontend Command Center:** `http://localhost:5174`
   - **4-Border Orchestrator API:** `http://localhost:4001/api/status`
2. **Browser Setup:**
   - Open `http://localhost:5174` in full-screen dark mode (`125%` zoom looks razor-sharp on stage projectors).
   - Keep **Auto-Pilot: ON (20s)** or toggle **OFF** if you want full manual control while narrating each scenario click.
   - **Zero-Crash Guarantee:** Every border (1 → 4) has deterministic fallback guards, and the React UI is wrapped in a dark-mode `ErrorBoundary` with one-click state recovery.

---

## 🏆 2. Judge Persona Matrix — What Every Panel Proves

| Judge Persona (Ankara Panel) | Primary UI Panel to Highlight | What It Proves Live on Stage |
| :--- | :--- | :--- |
| **OKX TR BD Managers (×2)** | **Q1 (Live Corridor) + Q3 (OKX ATK CLI Terminal) + Q4 (Simple Earn Sweep)** | Deep mastery of **all 7 OKX Agent Trade Kit (ATK) modules** (`okx-cex-market`, `okx-cex-bot`, `okx-cex-trade`, `okx-cex-asset`, `okx-cex-earn`, `okx-onchain-market`, `okx-cex-account`). Uses `okx bot grid amend` for **zero-fee in-flight surgery** instead of wasteful cancel/recreate cycles, and locks 50% of realized profit into **OKX Simple Earn**. |
| **Avalanche Team1 DevRels (×2)** | **Q4 (Avalanche C-Chain Anchor) + `contracts/GridSurgeonRegistry.sol`** | Native focus on **`AVAX-USDT-SWAP`** liquidity + verifiable **Avalanche C-Chain / Fuji (`ChainID 43113`)** integration. Every trading decision is hashed (`keccak256`), ABI-encoded for `recordDecision(...)`, and ready for 1-click **Core / MetaMask** broadcast. |
| **Cryptography Researcher** | **Top 4-Border Ribbon Inspector + Q2 (`D_trap` Formula) + Q4 (`bytes32 _reasoningHash`)** | Deterministic quantitative state machine (`D_trap = S_retail + 0.5·F_norm - 1.5·W_whale`) paired with canonical JSON serialization, `keccak256` commitment hashes, and secp256k1 operator signatures preventing post-hoc AI track-record tampering. |
| **Web3 Founder / VC** | **5 Scenario Triggers + Q4 High-Water Mark Treasury (`18 → 6 → Earn`)** | Solves the #1 reason retail grid bots go to zero: **boundary drift liquidation** and **giving back range profits during macro breakouts**. Principal is ratcheted into Simple Earn via a High-Water Mark (HWM) treasury invariant. |

---

## ⏱️ 3. Minute-by-Minute 10-Minute Pitch & Click Choreography

### 🟢 `0:00 – 1:30` | The Hook & Unbreakable 4-Border Architecture
- **What to Say:**
  > *"90% of retail grid bots on perpetual swaps make steady pennies for a week and then lose everything in one afternoon when price drifts out of bounds or whales spring a bull trap. Meet **Grid-Surgeon**: an autonomous agent built on the **OKX Agent Trade Kit (ATK)** and anchored on **Avalanche C-Chain** that performs live in-flight surgery on `AVAX-USDT-SWAP` bots before they bleed."*
- **What to Click:**
  1. Point to the **Top Institutional Header**: highlight live `AVAX-USDT-SWAP` price, active regime pill, and cycle execution latency (`ms`).
  2. Click **`BORDER 1: SENSE`** in the **Unbreakable 4-Border Pipeline Architecture** ribbon to expand the live JSON contract inspector.
  3. Briefly click **`BORDER 2: BRAIN` → `BORDER 3: EXECUTE` → `BORDER 4: ANCHOR`**, then click **`Close [×]`**.
- **Key Takeaway for Judges:** Strict typed input/output contracts across all 4 borders with zero unhandled exceptions.

---

### ⚡ `1:30 – 3:00` | Click #1: `⚡ Run Live OKX Cycle` (Live OKX ATK CLI Sensor Fusion)
- **What to Click:**
  - Click Button #1: **`⚡ Run Live OKX Cycle`** in the Scenario Trigger bar.
- **Where to Point:**
  - Point to **Quadrant 1 (Q1)**: Show live `AVAX-USDT-SWAP` price, **1H ATR(14)**, **ADX(14)**, **RSI(14)**, **Bollinger Band Width**, and the **12-Level Contract Grid Ladder** (`L0` to `L11`).
  - Point to **Quadrant 3 (Q3 — Live OKX ATK CLI Execution Stream)**: Click any row (`$ okx market ticker AVAX-USDT-SWAP --json` or `$ okx market candles AVAX-USDT-SWAP --bar 1H`) to expand the raw JSON returned by the `/opt/homebrew/bin/okx` binary.

---

### 🔧 `3:00 – 4:45` | Click #2: `🔧 Simulate Boundary Drift` (In-Flight Grid Surgery)
- **What to Say:**
  > *"When AVAX drifts into the top or bottom 12% of a grid corridor, normal bots either get liquidated or force you to cancel and recreate—paying double taker fees. Grid-Surgeon uses OKX ATK's `okx bot grid amend` to perform live in-flight surgery."*
- **What to Click:**
  - Click Button #2: **`🔧 Simulate Boundary Drift`**.
- **Where to Point:**
  - Watch the **Grid Corridor Utilization Bar** in **Q1** jump to **`93.4% (⚡ SURGERY TRIGGERED)`**.
  - Point to the **In-Flight Bot Surgery Log (`okx bot grid amend`)** at the bottom of **Q1**: show the exact `Old [minPx, maxPx] → New [minPx, maxPx]` and updated `TP / SL` triggers recentered around live AVAX price + `1.8 × ATR`.
  - Point to **Q3** to show the exact `$ okx bot grid amend --algoId ... --newMinPx ... --newMaxPx ... --demo --json` CLI invocation.

---

### 🪤 `4:45 – 6:30` | Click #3: `🪤 Trigger Bull Trap` (ContraCrowd Whale Divergence)
- **What to Say:**
  > *"What if ranging ends and a violent fakeout begins? In Q2, our ContraCrowd Radar fuses OKX social sentiment (`S_retail`), perpetual funding rate (`F_norm`), and on-chain Smart Money whale flows (`W_whale`) into a single quantitative score: `D_trap`."*
- **What to Click:**
  - Click Button #3: **`🪤 Trigger Bull Trap`**.
- **Where to Point:**
  - Point to **Quadrant 2 (Q2)**:
    - **Retail Sentiment (`S_retail`):** `87% Bullish` (`+0.74`) — retail is FOMO-longing resistance.
    - **Smart Money Whales (`W_whale`):** `-0.61` (`$12.4M Short` vs `$3.0M Long`) — whales are heavily shorting.
    - **Trap Score Formula:** `D_trap = +1.96 (+196 bps) > +1.10` → **`BULL_TRAP_SHORT`** regime activated!
  - Point to the bottom of **Q2** & **Q3**: Grid-Surgeon automatically pauses the vulnerable grid (`okx bot grid stop`) and fires a **3x Counter-Trap Short** (`okx Swap place`) with a **1.5% Trailing Stop** (`okx Swap algo trail`).

---

### 💰 `6:30 – 8:00` | Click #4: `💰 High-Water Profit Sweep` & `🛡️ Macro Shock Bunker`
- **What to Say:**
  > *"Winning a trade means nothing if the bot gives it back tomorrow. Every time portfolio NAV hits a new High-Water Mark, Grid-Surgeon sweeps 50% of realized profit out of the margin account and locks it into OKX Simple Earn."*
- **What to Click:**
  1. Click Button #4: **`💰 High-Water Profit Sweep`**.
     - Point to **Quadrant 4 (Q4)** Treasury Cards: show `$42.30 USDT` swept from **Trading Account (`18`) → Funding Account (`6`) → Simple Earn Locked (`8.4% APY`)** via `okx asset transfer` + `okx earn purchase`.
  2. Click Button #5: **`🛡️ Macro Shock Bunker`**.
     - Point to **Q2 US Macro Calendar** (`🚨 14m to CPI/FOMC`) and **Q3**: the agent automatically de-leverages `AVAX-USDT-SWAP` from `3x → 1x` (`okx account set-leverage`) and tightens OCO Stop-Loss to `0.6%`.

---

### ⛓️ `8:00 – 9:15` | Click #5: `⛓️ Anchor Decision On-Chain` (Avalanche C-Chain Proof)
- **What to Say:**
  > *"How does an institutional allocator or copy-trader verify that our AI agent didn't cherry-pick or backdate its reasoning? In Border 4, every decision cycle—regime, `D_trap` basis points, OKX `algoId`, and canonical reasoning JSON—is hashed with `keccak256` and committed to `GridSurgeonRegistry.sol` on Avalanche."*
- **What to Click:**
  - In **Quadrant 4 (Q4)**, click **`Copy Hash`** or **`Copy Calldata`** to show the real `recordDecision(...)` ABI payload.
  - Click **`⛓️ Anchor Decision On-Chain (Core / MetaMask)`**:
    - If Core/MetaMask is connected on Fuji (`43113`), approve the transaction live.
    - If presenting in a clean browser without an extension, point out the instant green confirmation banner: *Copied signed `recordDecision(...)` ABI Calldata to clipboard!*

---

## 🧠 4. Rapid-Fire Judge Q&A Cheat Sheet (`9:15 – 10:00`)

- **Q (OKX BD): *"Why use `okx bot grid amend` instead of stopping and starting a new grid?"***
  - **A:** Stopping a contract grid forces immediate market close or orphans open inventory, paying taker fees (`5 bps`) on every leg. `okx bot grid amend` shifts the corridor bounds (`minPx`/`maxPx`) and `TP/SL` triggers in-flight while preserving the active `algoId` and maker fee rebates.
- **Q (Cryptography Researcher): *"What exactly is inside the `bytes32 _reasoningHash` on Avalanche?"***
  - **A:** It is the `keccak256` digest of the canonicalized JSON payload combining Border 1 sensor inputs (`lastPx`, `atr14`, `adx14`, `sRetail`, `wWhale`) and Border 2 mathematical outputs (`dTrapBps`, `regime`, `corridorPositionPct`). Anyone with the JSON log can deterministically recompute the hash and verify it against `GridSurgeonRegistry.verifyReasoningHash(anchorId, rawJson)` on Avalanche C-Chain.
- **Q (Avalanche DevRel): *"How does Grid-Surgeon support the Avalanche ecosystem?"***
  - **A:** First, it deepens automated maker liquidity specifically on `AVAX-USDT-SWAP` with self-healing volatility corridors tailored to AVAX's ATR profile. Second, `GridSurgeonRegistry.sol` turns Avalanche C-Chain into a high-speed, sub-second verifiable audit layer for autonomous CEX+DEX AI agents.

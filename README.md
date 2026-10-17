# Grid-Surgeon
**Autonomous Self-Healing Bot Orchestrator & Whale-Divergence Trap Hunter on `AVAX`**  
*Built for the OKX TR × Avalanche Team1 Agentic Hackathon (Ankara, Oct 17, 2026)*

---

## 1. What This Project Does (Executive Overview)
**Grid-Surgeon** is an autonomous, regime-switching AI asset manager built specifically for **`AVAX-USDT`** and **`AVAX-USDT-SWAP`** using the **OKX Agent Trade Kit (ATK)** (`@okx_ai/okx-trade-cli`) and anchored on **Avalanche C-Chain**.

Instead of acting as a naive LLM that guesses 1-minute candle directions, this agent solves the two biggest failure modes in retail crypto automation:
1. **In-Flight Bot Surgery in Ranging Markets:** Most of the time, crypto consolidates. Static grid bots perform well in ranges but fail when price drifts near the boundaries (`minPx` / `maxPx`) or liquidates on sudden volatility. **Grid-Surgeon** continuously monitors Bollinger Bandwidth (`bb`), `ADX`, `ATR`, and `okx bot grid liquidate-price`, performing **live in-flight surgery** (`okx bot grid amend`) on running OKX server-side Grid Bots to shift price corridors and TP/SL levels *before* the bot breaks—without closing the bot.
2. **Retail-vs-Whale Divergence Trap Hunting:** Naive sentiment bots buy when social news is bullish, turning them into exit liquidity for whales. **Grid-Surgeon** cross-examines **Retail Social Sentiment** (`okx-sentiment-tracker`) against **Whale Positioning** (`okx-cex-smartmoney`), **Open Interest Spikes** (`okx market oi-change`), and **Funding Rates**. When retail is euphoric (>75% bullish) while whales are building net short notional and OI is overheating, the agent detects a **Bull Trap**, stops the grid bot, and executes an asymmetric counter-trade (`okx swap place` with OCO TP/SL or `okx swap algo trail`) or an **RSI-triggered DCA Martingale Bot** (`okx bot dca create`).
3. **High-Water Mark Profit Lock & Avalanche C-Chain Anchor:** Whenever a trade or bot cycle closes in profit, the agent automatically sweeps 50% of realized profit out of the Unified Trading Account (`18`) into the Funding Account (`6`) via `okx account transfer` and subscribes it into **OKX Simple Earn** (`okx earn savings purchase`) so it can never over-trade its gains away. Every regime switch, grid surgery, and NAV snapshot is cryptographically hashed and recorded on **Avalanche C-Chain** (`contracts/GridSurgeonRegistry.sol`).

---

## 2. Hackathon Alignment & Scoring Strategy
* **Main Task (Mandatory):** Autonomous AI agent built with **OKX Agent Trade Kit (ATK)** across **7 ATK skills** (`okx-cex-market`, `okx-sentiment-tracker`, `okx-cex-smartmoney`, `okx-cex-bot`, `okx-cex-trade`, `okx-cex-portfolio`, `okx-cex-earn`).
* **Bonus 1 (+Extra Score):** Real market condition trading on `AVAX-USDT-SWAP` / `AVAX-USDT` (supports both `--demo` and Live modes).
* **Bonus 2 (+Extra Score):** Deployed on **Avalanche** (`GridSurgeonRegistry.sol` on Avalanche C-Chain / Fuji Testnet).
* **Judging Criteria Coverage:**
  * **35% Agent Architecture & Autonomy:** Fully autonomous 20-second `Sense → Reason → Act → Anchor` daemon loop with zero human intervention required.
  * **25% Product & Strategy:** Combines server-side grid bot surgery, whale divergence counter-trading, macro bunker protection, and high-water mark profit locking.
  * **20% Technical Quality:** Uses deterministic quantitative formulas + real OKX CLI JSON pipelines + on-chain cryptographic state anchoring.
  * **20% Live Demo & Presentation:** Includes a 4-quadrant real-time Command Center UI with 5 one-click stage demo scenario buttons.

---

## 🚀 Zero-Touch 1-Click Quick Start (Vibecoder Ready)

No manual configuration or code editing required. Simply run:

```bash
cd /Users/goktus/Desktop/Grid-Surgeon
./start.sh
# Or equivalently:
npm start
```

* **Backend 4-Border Pipeline API:** `http://localhost:4001` (`/api/status`, `/api/cycle`, `/api/scenario`, `/api/autopilot`, `/api/contract`)
* **Interactive 4-Quadrant Command Center UI:** `http://localhost:5173`

### Unbreakable 4-Border Pipeline Guarantee
1. **Border 1 (`PHASE 1: SENSE` — `backend/src/pipeline/phase1Sense.ts`)**: Executes real `@okx_ai/okx-trade-cli` (`okx`) commands with strict 8-second timeouts, deterministic 50-candle `ATR_14`, `ADX_14`, `RSI_14`, and `BB(20,2)` calculation, and never-throwing fallback enrichment.
2. **Border 2 (`PHASE 2: BRAIN` — `backend/src/pipeline/phase2Brain.ts`)**: Pure quantitative engine computing Bollinger Bandwidth ($BBW$), Retail-vs-Whale Trap Divergence Score ($D_{\text{trap}}$), and Grid Corridor Drift Surgery (`<12%` or `>88%` boundary breach $\rightarrow$ recenter via $\pm 2.5 \times \text{ATR}_{14}$).
3. **Border 3 (`PHASE 3: EXECUTE` — `backend/src/pipeline/phase3Execute.ts`)**: Executes OKX ATK bot/swap/earn commands (`okx bot grid amend`, `okx bot grid liquidate-price`, `okx swap place`, `okx swap algo trail`, `okx account transfer`, `okx earn savings purchase`) with automatic Demo-Safe Execution protection.
4. **Border 4 (`PHASE 4: AVALANCHE ANCHOR` — `backend/src/pipeline/phase4Anchor.ts`)**: Auto-manages an Avalanche EVM operator wallet, computes the `keccak256` `reasoningHash`, signs it with ECDSA, compiles `contracts/GridSurgeonRegistry.sol` with `solc`, and encodes exact `recordDecision(...)` and `recordGridSurgery(...)` ABI calldata for Avalanche Fuji (`43113`) / C-Chain (`43114`).

---

## 3. System Architecture & Autonomous 4-Phase Loop

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: MULTI-MODAL SENSING                        │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │   okx-cex-market    │  │ okx-sentiment-tracker│  │ okx-cex-smartmoney│  │
│  │ • ADX, BB, RSI, ATR │  │ • AVAX Bull/Bear %   │  │ • Whale Long/Short│  │
│  │ • Funding Rate      │  │ • Sentiment Trend 24h│  │   Notional & Ratio│  │
│  │ • OI Change Scanner │  │ • Macro Calendar     │  │ • Top Trader Pos  │  │
│  └──────────┬──────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
└─────────────┼────────────────────────┼────────────────────────┼────────────┘
              ▼                        ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  PHASE 2: QUANTITATIVE REGIME & TRAP BRAIN                 │
│  1. Macro Bunker Check: Any US High-Impact (Importance=3) event in <30m?   │
│  2. Regime Score: Compute ADX + Bollinger Bandwidth (Ranging vs Breakout)  │
│  3. Trap Divergence Score: Retail Bullish % vs Whale Net Notional Delta    │
└─────────────┬────────────────────────┬────────────────────────┬────────────┘
              ▼                        ▼                        ▼
   [REGIME A: RANGING]      [REGIME B: TRAP / TREND]   [REGIME C: MACRO SHOCK]
   • Deploy/Monitor Grid    • Stop Grid Bot            • De-leverage to 1x-2x
   • Check Liquidate Price  • Open Counter-Trap Swap   • Tighten OCO SL
   • Live Surgery:          • Or Launch RSI DCA Bot    • Park Cash in Earn
     `okx bot grid amend`   • Attach Trailing Stop
              │                        │                        │
              └────────────────────────┼────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│              PHASE 3: TREASURY SWEEP & AVALANCHE C-CHAIN ANCHOR            │
│  • Check Realized PnL (`okx account positions-history` & `balance-all`)    │
│  • Sweep 50% of New Profit: Trading (18) → Funding (6) → Simple Earn       │
│  • Commit State Hash (Regime, Trap Score, NAV, Action) to Avalanche C-Chain│
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Quantitative & Signal Formulas

### A. Market Regime Classifier ($R$)
Using `okx-cex-market` indicators on `AVAX-USDT-SWAP` (`--bar 1H`):
* **Bollinger Bandwidth ($BBW$):**
  $$BBW = \frac{BB_{\text{upper}} - BB_{\text{lower}}}{BB_{\text{middle}}}$$
* **Classification Rules:**
  * **Ranging Regime (`RANGING_GRID`):** $\text{ADX}_{14} < 25$ and $|\Delta \text{OI}_{1\text{H}}| < 3\%$.
  * **Breakout / Trend Regime (`BREAKOUT_DCA`):** $\text{ADX}_{14} \ge 25$ and $|\Delta \text{OI}_{1\text{H}}| \ge 3\%$.
  * **Grid Drift Surgery Trigger (`GRID_AMEND`):** Running grid bot price $P_{\text{current}}$ enters the top or bottom $12\%$ of $[P_{\text{min}}, P_{\text{max}}]$:
    $$\frac{P_{\text{current}} - P_{\text{min}}}{P_{\text{max}} - P_{\text{min}}} > 0.88 \quad \text{or} \quad < 0.12$$
    New boundaries are recentered to $[P_{\text{current}} - 2.5 \times \text{ATR}_{14},\; P_{\text{current}} + 2.5 \times \text{ATR}_{14}]$.

### B. Retail-vs-Whale Divergence Trap Score ($D_{\text{trap}}$)
* $S_{\text{retail}} \in [-1, +1]$ = $\text{bullishRatio} - \text{bearishRatio}$ from `okx news coin-sentiment --coins AVAX`.
* $W_{\text{whale}} \in [-1, +1]$ = $\frac{\text{longNotional} - \text{shortNotional}}{\text{longNotional} + \text{shortNotional}}$ from `okx smartmoney signal-overview-by-filter --instCcyList AVAX`.
* $F_{\text{norm}} \in [-1, +1]$ = Normalized perpetual funding rate ($\text{clamp}(\text{fundingRate} / 0.001, -1, 1)$).

$$D_{\text{trap}} = S_{\text{retail}} + 0.5 \cdot F_{\text{norm}} - 1.5 \cdot W_{\text{whale}}$$

* **Bull Trap (`BULL_TRAP_SHORT`):** $D_{\text{trap}} > +1.10$ (Retail is euphoric & paying positive funding, while OKX Smart Money whales are heavily net short).
* **Bear Trap / Short Squeeze (`BEAR_TRAP_LONG`):** $D_{\text{trap}} < -1.10$ (Retail is panicking & funding is negative, while OKX Smart Money whales are accumulating longs).

---

## 5. Complete OKX ATK Command Playbook

### Step 1: Pre-Flight & Account Health (`okx-cex-auth` & `okx-cex-portfolio`)
```bash
okx config show --json
okx auth status --json
okx account balance-all --json
okx account positions --instType SWAP --instId AVAX-USDT-SWAP --json
okx market instruments --instType SWAP --instId AVAX-USDT-SWAP --json
```

### Step 2: Multi-Modal Sensing (`okx-cex-market`, `okx-sentiment-tracker`, `okx-cex-smartmoney`)
```bash
# Technicals & Regime Indicators (No API Key needed)
okx market ticker AVAX-USDT-SWAP --json
okx market indicator rsi AVAX-USDT-SWAP --bar 1H --params 14 --json
okx market indicator bb AVAX-USDT-SWAP --bar 1H --params 20,2 --json
okx market indicator supertrend AVAX-USDT-SWAP --bar 1H --json
okx market funding-rate AVAX-USDT-SWAP --json
okx market oi-history AVAX-USDT-SWAP --bar 1H --limit 24 --json
okx market oi-change --instType SWAP --bar 1H --sortBy absOiDeltaPct --limit 15 --json

# Retail Social Sentiment & Macro Calendar
okx news coin-sentiment --coins AVAX,BTC --period 4h --json
okx news coin-trend AVAX --period 1h --points 24 --json
okx news sentiment-rank --period 4h --sort-by bullish --limit 10 --json
okx news by-coin --coins AVAX --importance high --limit 5 --json
okx news economic-calendar --region united_states --importance 3 \
  --before $(date -v0H -v0M -v0S +%s000) --after $(date -v+2d -v0H -v0M -v0S +%s000) --limit 50 --json

# Smart Money Whale Consensus
okx smartmoney signal-overview-by-filter --instCcyList AVAX,BTC,SOL --json
okx smartmoney signal-trend-by-filter --instCcy AVAX --granularity 1h --limit 24 --json
okx smartmoney traders-by-filter --limit 5 --json
```

### Step 3: Bot Deployment & In-Flight Surgery (`okx-cex-bot`)
```bash
# Pre-check liquidation price BEFORE creating a contract grid bot
okx bot grid liquidate-price --instId AVAX-USDT-SWAP --sz 100 --lever 3 \
  --minPx 22.50 --maxPx 27.50 --gridNum 12 --direction neutral --json

# Create neutral contract grid bot in Ranging Regime
okx bot grid create --instId AVAX-USDT-SWAP --algoOrdType contract_grid \
  --minPx 22.50 --maxPx 27.50 --gridNum 12 \
  --direction neutral --lever 3 --sz 100 \
  --tpTriggerPx 29.00 --slTriggerPx 21.00 --json

# Monitor active grid bot & sub-orders
okx bot grid orders --algoOrdType contract_grid --instId AVAX-USDT-SWAP --json
okx bot grid details --algoOrdType contract_grid --algoId <algoId> --json
okx bot grid positions --algoId <algoId> --algoOrdType contract_grid --json

# IN-FLIGHT BOT SURGERY: Shift grid corridor & TP/SL without stopping the bot
okx bot grid amend --algoId <algoId> \
  --minPx 24.00 --maxPx 29.50 --gridNum 12 \
  --instId AVAX-USDT-SWAP --tpTriggerPx 31.00 --slTriggerPx 22.50 --json
```

### Step 4: Divergence Trap Execution & Trailing Stops (`okx-cex-trade` & `okx-cex-bot`)
```bash
# Stop grid bot cleanly when a Trap or Regime Breakout is detected
okx bot grid stop --algoId <algoId> --algoOrdType contract_grid --instId AVAX-USDT-SWAP --stopType 1 --json

# Check maximum available order size
okx account max-avail-size --instId AVAX-USDT-SWAP --tdMode cross --json

# Option 1: Execute Counter-Trap Swap Order with attached OCO TP/SL
okx swap leverage --instId AVAX-USDT-SWAP --lever 3 --mgnMode cross --json
okx swap place --instId AVAX-USDT-SWAP --side sell --ordType market \
  --sz 300 --tgtCcy quote_ccy --tdMode cross --posSide short \
  --tpTriggerPx 23.00 --tpOrdPx=-1 --slTriggerPx 28.50 --slOrdPx=-1 --json

# Attach a 1.5% Trailing Stop to ride the whale flush
okx swap algo trail --instId AVAX-USDT-SWAP --side buy --sz 1 \
  --tdMode cross --posSide short --callbackRatio 0.015 --json

# Option 2: Or deploy an RSI-triggered Contract DCA Martingale Bot
okx bot dca create --algoOrdType contract_dca --instId AVAX-USDT-SWAP \
  --lever 3 --direction short --initOrdAmt 50 --safetyOrdAmt 50 --maxSafetyOrds 3 \
  --pxSteps 0.025 --pxStepsMult 1.2 --volMult 1.5 --tpPct 0.04 \
  --triggerStrategy rsi --triggerCond cross_down --thold 70 --timeframe 15m --json
```

### Step 5: High-Water Mark Profit Sweep (`okx-cex-portfolio` & `okx-cex-earn`)
```bash
okx account positions-history --instType SWAP --instId AVAX-USDT-SWAP --limit 5 --json
okx account transfer --ccy USDT --amt 25 --from 18 --to 6 --json
okx earn savings purchase --ccy USDT --amt 25 --json
okx earn savings balance USDT --json
```

---

## 6. Recommended Folder Structure for Antigravity IDE

When building this project in Antigravity IDE, structure the repository as follows:

```
Grid-Surgeon/
├── README.md
├── contracts/
│   └── GridSurgeonRegistry.sol              # Avalanche C-Chain Audit & Circuit-Breaker Contract
├── backend/
│   ├── src/
│   │   ├── okxCliRunner.ts                  # Wrapper around `okx ... --json` CLI commands
│   │   ├── sensors/
│   │   │   ├── marketSensor.ts              # ADX, BB, RSI, OI-Change, Funding Rate
│   │   │   ├── sentimentSensor.ts           # Coin sentiment, trend, macro calendar
│   │   │   └── smartMoneySensor.ts          # Whale long/short notional & signal trends
│   │   ├── brain/
│   │   │   ├── regimeClassifier.ts          # Ranging vs Breakout vs Macro Bunker math
│   │   │   └── trapDetector.ts              # Retail-vs-Whale divergence math
│   │   ├── executors/
│   │   │   ├── gridSurgeon.ts               # `bot grid create`, `liquidate-price`, `amend`, `stop`
│   │   │   ├── trapTrader.ts                # `swap place`, `swap algo trail`, `bot dca create`
│   │   │   └── profitSweeper.ts             # `account transfer` (18->6) + `earn savings purchase`
│   │   ├── avalanche/
│   │   │   └── anchorClient.ts              # viem/ethers client publishing proofs to Avalanche
│   │   └── server.ts                        # Express + WebSocket server streaming live telemetry
└── frontend/
    └── src/                                 # Next.js / Vite 4-Quadrant Command Center Dashboard
```

---

## 7. Next Steps in Antigravity IDE
Open this folder in Antigravity IDE and prompt the agent:
> *"Read `README.md` and `contracts/GridSurgeonRegistry.sol`. Initialize the TypeScript backend and Next.js/Vite 4-Quadrant Command Center UI, starting with `okxCliRunner.ts` and the live multi-modal sensor pipeline."*

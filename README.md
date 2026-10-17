# Grid-Surgeon

**Autonomous Self-Healing Grid & Market-Making Orchestrator on `AVAX`**  
*Powered by OKX Agent Trade Kit CLI (`@okx_ai/okx-trade-cli`) & Anchored on Avalanche C-Chain (ERC-8004)*

---

## Overview

**Grid-Surgeon** is an autonomous, non-custodial quantitative trading agent built for **`AVAX-USDT`** and **`AVAX-USDT-SWAP`**. It combines 7 modules of the **OKX Agent Trade Kit (ATK)** with verifiable on-chain state anchoring and drawdown circuit-breaker protection on **Avalanche**.

Instead of relying on static grid parameters or naive directional speculation, Grid-Surgeon addresses three core failure modes in automated trading:

1. **In-Flight Corridor Surgery & 2-Tranche Split-Harvest:** Static grid bots fail when price drifts outside their initial range or place sell orders below their fee-adjusted cost basis. Grid-Surgeon continuously reads real fill history (`okx spot fills`) to compute exact **VWAP cost basis**, splits inventory into a **2-Tranche Exit** (`T1` Quick Scalp + `T2` Alpha Runner with time-decay skew), and performs **in-flight order surgery** (`okx spot amend` / `okx bot grid amend`) with `8 bps` hysteresis to preserve exchange FIFO queue priority.
2. **Whale-vs-Retail Divergence Trap Radar ($D_{\text{trap}}$):** Retail bots frequently buy into euphoric news while Smart Money whales distribute. Grid-Surgeon cross-examines **Retail Social Sentiment** (`okx news coin-sentiment`) against **Smart Money Whale Positioning** (`okx smartmoney signal-overview-by-filter`), **Open Interest Delta** (`okx market oi-history`), and **Funding Rates**. When a **Bull Trap** ($D_{\text{trap}} > +1.10$) is detected, new buy entries are automatically blocked.
3. **Autonomous Simple Earn Profit Lock & Avalanche C-Chain Seal:** Completed round-trip profits are transferred from the Trading Account to the Funding Account (`okx account transfer`) and subscribed into **OKX Simple Earn** (`okx earn savings purchase`). Every cycle's quantitative payload is hashed (`keccak256`), signed via EIP-191 ECDSA, and anchored on **Avalanche Fuji C-Chain** with sub-second finality and an autonomous **3.0% Max-Drawdown On-Chain Circuit Breaker**.

---

## Contracts (Avalanche Fuji Testnet `43113`)

All custom contracts are deployed and source-code verified on Snowtrace alongside the official Ava Labs **ERC-8004** (`8004-boilerplate`) registries:

| Contract | Address | Snowtrace Explorer |
| :--- | :--- | :--- |
| **`GridSurgeonRegistry.sol`** | `0x7c52f6b7b588698700abbac6cbe37f3cfca305cd` | [View on Snowtrace ↗](https://testnet.snowtrace.io/address/0x7c52f6b7b588698700abbac6cbe37f3cfca305cd) |
| **`ValidationRegistry.sol`** | `0xffe3478342c44f82cb1690638c162716e8648290` | [View on Snowtrace ↗](https://testnet.snowtrace.io/address/0xffe3478342c44f82cb1690638c162716e8648290) |
| **`TaskAgent.sol`** | `0xc08c7203e32d4bc0a17b5463a2c8b675c1e4c530` | [View on Snowtrace ↗](https://testnet.snowtrace.io/address/0xc08c7203e32d4bc0a17b5463a2c8b675c1e4c530) |
| **`IdentityRegistry.sol` (ERC-8004)** | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | [View on Snowtrace ↗](https://testnet.snowtrace.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| **`ReputationRegistry.sol` (ERC-8004)** | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | [View on Snowtrace ↗](https://testnet.snowtrace.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

---

## Quick Start

### 1. Install & Build
```bash
npm run install:all
npm run build
```

### 2. Start Backend (`:4001`) & Frontend (`:5173`)
```bash
npm run dev:backend
npm run dev:frontend
```

* **Backend API:** `http://localhost:4001` (`/api/status`, `/api/cycle`, `/api/action`, `/api/autopilot`, `/api/verify-hash/:hash`)
* **Frontend UI:** `http://localhost:5173`

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: MULTI-MODAL SENSING                        │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐  │
│  │   okx-cex-market    │  │ okx-sentiment-tracker│  │ okx-cex-smartmoney│  │
│  │ • Candles & OBI(10) │  │ • AVAX Bull/Bear %   │  │ • Whale Long/Short│  │
│  │ • ATR, ADX, RSI, BB │  │ • Sentiment Ratio    │  │   Notional & Ratio│  │
│  │ • Funding & 1H OI Δ │  │ • Macro Calendar     │  │ • Top Trader Flow │  │
│  └──────────┬──────────┘  └──────────┬───────────┘  └─────────┬─────────┘  │
└─────────────┼────────────────────────┼────────────────────────┼────────────┘
              ▼                        ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  PHASE 2: QUANTITATIVE REGIME & TRAP BRAIN                 │
│  1. Avellaneda-Stoikov Reservation Price & Variance Ratio Scaling          │
│  2. Inventory (q) + Time-Decay (τ) 2-Tranche Ask-Skew (T1 & T2 Targets)    │
│  3. Retail-vs-Whale Trap Divergence Score (D_trap) & Toxic Flow Guard      │
└─────────────┬────────────────────────┬────────────────────────┬────────────┘
              ▼                        ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               PHASE 3: LIVE OKX EXECUTION & EARN PROFIT LOCK               │
│  • True Fill-Ledger VWAP Cost Basis (`okx spot fills`)                     │
│  • FIFO-Preserving In-Flight Order Surgery (`okx spot amend` / `grid amend`)│
│  • Autonomous Profit Sweep: Trading (18) → Funding (6) → OKX Simple Earn   │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│              PHASE 4: AVALANCHE C-CHAIN & ERC-8004 ATTESTATION             │
│  • Hash Decision Payload (`keccak256`) & Sign via EIP-191 ECDSA            │
│  • Broadcast Proof to `GridSurgeonRegistry` & `ValidationRegistry` (Fuji)  │
│  • Autonomous 3.0% Max-Drawdown On-Chain Circuit Breaker                   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Quantitative & Signal Formulas

### 1. Avellaneda-Stoikov Reservation Price & 2-Tranche Exit
* **Depth-Weighted Order Book Imbalance ($\text{OBI}_{10}$):** Exponentially weighted across the top 10 bid/ask levels from `okx market orderbook`.
* **Reservation Price ($R_{px}$):**
  $$R_{px} = P_{\text{micro}} + 0.35 \cdot \alpha_{\text{flow}} \cdot \text{ATR}_{14} - \gamma_{\text{eff}} \cdot q \cdot \text{ATR}_{14}$$
* **2-Tranche Fee-Protected Exit (`T1` & `T2`):** Anchored strictly above the realized fill-ledger **VWAP cost basis** plus round-trip maker fees ($\ge 18\text{ bps}$), dynamically skewed by inventory ratio $q$ and holding time decay $\tau$.

### 2. Retail-vs-Whale Divergence Trap Score ($D_{\text{trap}}$)
* $S_{\text{retail}} \in [-1, +1]$ = $\text{bullishRatio} - \text{bearishRatio}$ from `okx news coin-sentiment`.
* $W_{\text{whale}} \in [-1, +1]$ = $\frac{\text{longNotional} - \text{shortNotional}}{\text{longNotional} + \text{shortNotional}}$ from `okx smartmoney signal-overview-by-filter`.
* $F_{\text{norm}} \in [-1, +1]$ = Normalized perpetual funding rate ($\text{clamp}(\text{fundingRate} / 0.001, -1, 1)$).

$$D_{\text{trap}} = S_{\text{retail}} + 0.5 \cdot F_{\text{norm}} - 1.5 \cdot W_{\text{whale}}$$

* **Bull Trap (`BULL_TRAP_SHORT`):** $D_{\text{trap}} > +1.10$ (Retail crowd is euphoric while Smart Money whales are heavily net short $\rightarrow$ blocks new spot buy entries).
* **Bear Trap (`BEAR_TRAP_LONG`):** $D_{\text{trap}} < -1.10$ (Retail crowd is panicking while Smart Money whales accumulate longs).

---

## Repository Structure

```
Grid-Surgeon/
├── README.md
├── package.json
├── deployment-fuji.json                     # Avalanche Fuji (43113) Deployment Manifest
├── config/
│   └── agent.config.js                      # ERC-8004 Agent Configuration
├── .well-known/
│   └── agent-card.json                      # ERC-8004 Agent Discovery Manifest (Agent #257)
├── contracts/
│   ├── GridSurgeonRegistry.sol              # On-Chain Decision & Surgery Ledger + Circuit Breaker
│   ├── ValidationRegistry.sol               # ERC-8004 Task Validation Registry
│   ├── TaskAgent.sol                        # ERC-8004 Task Agent Contract
│   ├── IdentityRegistry.sol                 # ERC-8004 Agent Identity Registry Interface
│   └── ReputationRegistry.sol               # ERC-8004 Agent Reputation Registry Interface
├── backend/
│   └── src/
│       ├── okxCliRunner.ts                  # Bounded @okx_ai/okx-trade-cli Process Runner
│       ├── pipeline/
│       │   ├── phase1Sense.ts               # Phase 1: Multi-Modal OKX CLI Telemetry
│       │   ├── phase2Brain.ts               # Phase 2: Stoikov Pricing, D_trap & Corridor Math
│       │   ├── phase3Execute.ts             # Phase 3: 2-Tranche Execution, VWAP & Earn Sweep
│       │   ├── phase4Anchor.ts              # Phase 4: Avalanche Fuji & ERC-8004 Attestation
│       │   └── orchestrator.ts              # 4-Phase Autonomous Pipeline Orchestrator
│       └── server.ts                        # Express API Server (:4001)
└── frontend/
    └── src/                                 # React + Tailwind 4-Panel Command Center (:5173)
```

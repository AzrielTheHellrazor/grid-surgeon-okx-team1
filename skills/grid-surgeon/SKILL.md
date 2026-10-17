---
name: grid-surgeon
description: "Autonomous OKX.AI Service & Skill for self-healing AVAX-USDT-SWAP contract grid bots (in-flight okx bot grid amend surgery), retail-vs-whale divergence trap hunting, and 50% High-Water Mark Simple Earn profit sweeping anchored on Avalanche (ERC-8004 Agent ID #257)."
license: MIT
metadata:
  author: grid-surgeon-team1
  version: "1.0.0"
  homepage: "https://github.com/AzrielTheHellrazor/grid-surgeon-okx-team1"
  okxAiService:
    category: "autonomous-bot-orchestrator"
    pricingModel: "10% High-Water Mark Performance Fee on Swept Simple Earn Profits"
    erc8004AgentId: 257
    avalancheIdentityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e"
    avalancheDecisionRegistry: "0x7c52f6b7b588698700abbac6cbe37f3cfca305cd"
  agent:
    requires:
      bins: ["okx"]
---

# Grid-Surgeon (OKX.AI Installable Autonomous Service Skill)

**Grid-Surgeon** is a production-ready autonomous agent skill designed to be listed and subscribed to on **OKX.AI** and the **OKX Skills Marketplace (`okx-cex-skill-mp`)**.

## Problem & Target User
- **Target Users:** Over 1.8M+ OKX retail grid-bot traders and delta-neutral USDT vaults who run `contract_grid` bots on `AVAX-USDT-SWAP`.
- **Core Problem:** Static grid bots suffer from two fatal flaws:
  1. **Boundary Drift Paralysis:** When `AVAX` drifts into the top/bottom 12% of `[minPx, maxPx]`, static bots stop capturing spread or hit liquidation.
  2. **Exit-Liquidity Bull Traps:** Retail traders turn on bullish grid bots when social sentiment is euphoric (>75% bullish) right as Smart Money whales build net short notional.

## Multi-Step Autonomous Tool Orchestration (7 OKX ATK Skills)
Every 20 seconds, Grid-Surgeon executes an unbreakable 4-Border loop without human prompting:
1. **Border 1 — Sense (`okx-cex-market`, `okx-sentiment-tracker`, `okx-cex-smartmoney`):**
   - Queries `okx market ticker`, `candles`, `indicator rsi`, `indicator bb`, `funding-rate`, `oi-history`, `oi-change`, `okx news coin-sentiment`, and `okx smartmoney signal-overview-by-filter`.
2. **Border 2 — Quantitative Brain:**
   - Computes Bollinger Bandwidth ($BBW$), Wilder `ADX(14)` & `ATR(14)`, Retail-vs-Whale Divergence Trap Score ($D_{\text{trap}} = S_{\text{retail}} + 0.5 F_{\text{norm}} - 1.5 W_{\text{whale}}$), and Grid Drift ratio.
3. **Border 3 — Act (`okx-cex-bot`, `okx-cex-trade`, `okx-cex-portfolio`, `okx-cex-earn`):**
   - **Ranging Drift (`<12%` or `>88%`):** Verifies liquidation safety via `okx bot grid liquidate-price` and performs **live in-flight surgery** via `okx bot grid amend` to recenter `[minPx, maxPx]` to $[P \pm 2.5 \times \text{ATR}_{14}]$ without closing the bot.
   - **Bull/Bear Trap ($|D_{\text{trap}}| > 1.10$):** Stops the grid bot (`okx bot grid stop`) and opens a counter-trap perpetual swap (`okx swap place` + `okx swap algo trail`).
   - **High-Water Mark Profit Lock:** Transfers 50% of realized profit from Trading (`18`) to Funding (`6`) (`okx account transfer`) and locks it into `okx earn savings purchase`.
4. **Border 4 — Avalanche Sub-Second Finality & ERC-8004 Anchor:**
   - Leverages Avalanche's sub-second Snowman finality (<1s) to verify on-chain circuit breakers and anchor the `keccak256` reasoning hash + EIP-191 signature to `GridSurgeonRegistry.sol` (`0x7c52f6b7b588698700abbac6cbe37f3cfca305cd`) under official Ava Labs ERC-8004 **Agent NFT `#257`**.

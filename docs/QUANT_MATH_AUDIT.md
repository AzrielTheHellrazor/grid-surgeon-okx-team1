# Grid Surgeon — Quantitative Finance & Mathematical Verification Audit

**Audit Status:** ✅ **PASSED (23/23 Deterministic Edge Suites + 1,000-Iteration Monte Carlo Fuzzing — 100.0% Pass Rate)**  
**Verification Script:** `node scripts/verify-quant-math.mjs`  
**Audited Modules:**
- Border 1 Sensing: `backend/src/pipeline/phase1Sense.ts`
- Border 2 Quantitative Brain: `backend/src/pipeline/phase2Brain.ts`
- Border 3 High-Water Mark Treasury Sweeper: `backend/src/pipeline/phase3Execute.ts`

---

## 1. Executive Summary

Every quantitative indicator, divergence score, grid corridor geometry calculation, liquidation boundary estimator, and treasury profit-sweep formula in **Grid Surgeon** has been audited for institutional-grade mathematical soundness and numerical stability. All division operations, square roots, moving averages, and normalization steps are protected by explicit domain guards (`safeNum`, `clamp`, `Math.max` floors, and zero-denominator branches), guaranteeing **zero possibility of `NaN`, `±Infinity`, or division-by-zero** under any market condition.

---

## 2. Mathematical Formula Specifications & Numerical Guards

### 2.1 Bollinger Bands $\text{BB}(20, 2)$ & Normalized Bandwidth ($\text{BBW}$)
- **Equations (`phase1Sense.ts` L448–456, L126–127 & `phase2Brain.ts` L22):**
  $$\mu_{\text{BB}} = \frac{1}{N}\sum_{i=1}^{N} C_i, \quad \sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(C_i - \mu_{\text{BB}})^2}, \quad N = \min(20, |\text{candles}|)$$
  $$\text{BB}_{\text{upper}} = \mu_{\text{BB}} + 2\sigma, \quad \text{BB}_{\text{lower}} = \mu_{\text{BB}} - 2\sigma$$
  $$\text{BBW}_{\%} = \begin{cases} \text{round}_2\!\left(\dfrac{\text{BB}_{\text{upper}} - \text{BB}_{\text{lower}}}{\mu_{\text{BB}}} \times 100\right) & \text{if } \mu_{\text{BB}} > 0 \\ 4.20 & \text{otherwise} \end{cases}, \quad \text{BBW} = \text{round}_4\!\left(\frac{\text{BBW}_{\%}}{100}\right)$$
- **Stability Proof:** Variance is a sum of squares ($\ge 0$), so $\sqrt{\sigma^2}$ is always real and non-negative. Division by $\mu_{\text{BB}}$ is guarded by `bbMiddle > 0`.

### 2.2 Relative Strength Index ($\text{RSI}_{14}$)
- **Equations (`phase1Sense.ts` L458–470):**
  $$\text{AvgGain} = \frac{1}{14}\sum_{\Delta C_i \ge 0} \Delta C_i, \quad \text{AvgLoss} = \frac{1}{14}\sum_{\Delta C_i < 0} |\Delta C_i|$$
  $$\text{RS} = \begin{cases} 100 & \text{if } \text{AvgLoss} = 0 \\ \dfrac{\text{AvgGain}}{\text{AvgLoss}} & \text{if } \text{AvgLoss} > 0 \end{cases}, \quad \text{RSI}_{14} = \text{round}_2\!\left(100 - \frac{100}{1 + \text{RS}}\right)$$
- **Stability Proof:** When `avgLoss === 0` (flat candles or monotonic pump), `RS` defaults to `100`, yielding $\text{RSI}_{14} = 99.01$. When `avgGain === 0` (monotonic crash), $\text{RS} = 0$, yielding $\text{RSI}_{14} = 0.00$. Thus $\text{RSI}_{14} \in [0.00, 99.01]$ strictly.

### 2.3 Average True Range ($\text{ATR}_{14}$)
- **Equations (`phase1Sense.ts` L473–497, L529 & `phase2Brain.ts` L20):**
  $$\text{TR}_i = \max\!\left(H_i - L_i,\; |H_i - C_{i-1}|,\; |L_i - C_{i-1}|\right)$$
  $$\text{ATR}_{14,\text{sense}} = \text{round}_4\!\left(\max\!\left(\frac{1}{\max(1, K)}\sum_{k=1}^{K}\text{TR}_k,\; 0.008 \cdot P_{\text{last}}\right)\right), \quad \text{ATR}_{14,\text{brain}} = \max\!\left(\text{ATR}_{14,\text{sense}},\; 0.01 \cdot P_{\text{last}}\right)$$
- **Stability Proof:** Dual volatility floors ($0.8\%$ in Border 1, $1.0\%$ in Border 2) guarantee $\text{ATR}_{14} > 0$ even when 50 consecutive candles are completely flat ($H_i = L_i = C_i$), preventing degenerate zero-width grids.

### 2.4 Average Directional Index ($\text{ADX}_{14}$)
- **Equations (`phase1Sense.ts` L485–530):**
  $$+\text{DI} = \frac{\sum_{14} +\text{DM}}{\sum_{14} \text{TR}} \times 100, \quad -\text{DI} = \frac{\sum_{14} -\text{DM}}{\sum_{14} \text{TR}} \times 100$$
  $$\text{DX} = \begin{cases} \dfrac{|+\text{DI} - -\text{DI}|}{+\text{DI} + -\text{DI}} \times 100 & \text{if } (+\text{DI} + -\text{DI}) > 0 \land \sum_{14}\text{TR} > 0 \\ 0 & \text{otherwise} \end{cases}$$
  $$\text{ADX}_{14} = \text{round}_2\!\left(\text{clamp}\!\left(\overline{\text{DX}}_{14},\; 8,\; 65\right)\right)$$
- **Stability Proof:** Both $\sum \text{TR} = 0$ and $+\text{DI} + -\text{DI} = 0$ are guarded prior to division, and the output is strictly clamped to $[8.00, 65.00]$.

### 2.5 Retail-vs-Whale Divergence Trap Score ($D_{\text{trap}}$)
- **Equations (`phase1Sense.ts` L243–252 & `phase2Brain.ts` L26–39):**
  $$S_{\text{retail}} = R_{\text{bullish}} - R_{\text{bearish}} \in [-1, +1], \quad F_{\text{norm}} = \text{clamp}\!\left(\frac{F_{\text{rate}}}{0.001},\; -1,\; +1\right) \in [-1, +1]$$
  $$W_{\text{whale}} = \begin{cases} \dfrac{N_{\text{long}} - N_{\text{short}}}{N_{\text{long}} + N_{\text{short}}} & \text{if } N_{\text{long}} + N_{\text{short}} > 0 \\ 0 & \text{otherwise} \end{cases} \in [-1, +1]$$
  $$D_{\text{trap}} = \text{round}_4\!\left(S_{\text{retail}} + 0.5 \cdot F_{\text{norm}} - 1.5 \cdot W_{\text{whale}}\right) \in [-3.0, +3.0], \quad D_{\text{trap,bps}} = \text{round}(1000 \cdot D_{\text{trap}}) \in [-3000, +3000]$$
- **Regime Thresholds:**
  - $D_{\text{trap}} > +1.10 \implies \text{BULL\_TRAP}$ (`EXECUTE_COUNTER_TRAP_SHORT`)
  - $D_{\text{trap}} < -1.10 \implies \text{BEAR\_TRAP}$ (`EXECUTE_COUNTER_TRAP_LONG`)
  - $|D_{\text{trap}}| \le 1.10 \implies \text{NO\_TRAP}$

### 2.6 Grid Drift $<12\%$ / $>88\%$ Detection & $\pm 2.5 \times \text{ATR}$ Recentering
- **Equations (`phase2Brain.ts` L42–77):**
  $$\text{Pos}_{\%} = \text{round}_4\!\left(\frac{P_{\text{last}} - P_{\min,\text{existing}}}{\max(0.0001,\; P_{\max,\text{existing}} - P_{\min,\text{existing}})}\right)$$
  $$\text{requiresSurgery} \iff \text{Pos}_{\%} < 0.12 \;\lor\; \text{Pos}_{\%} > 0.88 \;\lor\; \text{scenario} = \text{DRIFT\_SURGERY}$$
  $$\left[P_{\min,\text{recentered}},\; P_{\max,\text{recentered}}\right] = \left[P_{\text{last}} - 2.5 \cdot \text{ATR},\; P_{\text{last}} + 2.5 \cdot \text{ATR}\right]$$
  $$\text{TP}_{\text{trigger}} = P_{\max,\text{target}} + 1.2 \cdot \text{ATR}, \quad \text{SL}_{\text{trigger}} = \max\!\left(0.50,\; P_{\min,\text{target}} - 1.2 \cdot \text{ATR}\right)$$

### 2.7 Liquidation Price Estimation
- **Equation (`phase2Brain.ts` L180–182):**
  $$P_{\text{liq}} = \text{round}_4\!\left(P_{\min,\text{target}} \times \left(1 - \frac{1}{L \times 1.45}\right)\right), \quad L \in \{1, 3\}$$
- **Ordering Invariant:** For $L = 3$, $P_{\text{liq}} = 0.7701 \cdot P_{\min,\text{target}}$; for $L = 1$ (Macro Bunker), $P_{\text{liq}} = 0.3103 \cdot P_{\min,\text{target}}$. In all normal price regimes, $0 < P_{\text{liq}} < \text{SL}_{\text{trigger}} < P_{\min,\text{target}} < P_{\text{last}} < P_{\max,\text{target}} < \text{TP}_{\text{trigger}}$.

### 2.8 50% High-Water Mark Simple Earn Profit Sweep
- **Equations (`phase2Brain.ts` L133–140 & `phase3Execute.ts` L363–493):**
  $$S_{\text{earn}} = \text{round}_2(0.50 \times \Pi_{\text{realized}}), \quad \Delta\text{Trading} = \Pi_{\text{realized}} - S_{\text{earn}}$$
  $$\text{NAV}_{\text{new}} = \text{Trading}_{\text{new}} + \text{Funding}_{\text{new}} + \text{Earn}_{\text{new}}, \quad \text{HWM}_{\text{new}} = \max\!\left(\text{HWM}_{\text{prev}},\; \text{NAV}_{\text{new}}\right)$$

---

## 3. Stress Verification Matrix (`scripts/verify-quant-math.mjs`)

| # | Stress Scenario / Edge Case | Verified Output & Invariant | Status |
| :- | :--- | :--- | :-: |
| 01 | Source Code Formula Integrity Check | Exact AST/string match in `phase1Sense.ts` & `phase2Brain.ts` | ✅ PASS |
| 02 | Zero Volume & Completely Flat Candles | `BBW=0%`, `RSI=99.01`, `ATR_P1=0.20`, `ATR_P2=0.25`, `ADX=19.5` | ✅ PASS |
| 03 | `<15` Candle History Fallback Guard | Safe fallback `RSI=52.4`, `ADX=18.6`, `ATR=1.4%` | ✅ PASS |
| 04 | Empty Candle Array (`0` Bars) | Valid recentered corridor `[23.9803, 25.7198]` | ✅ PASS |
| 05 | Monotonic Vertical Pump (`+500%` Pure Gains) | `RSI=99.01 (<=100)`, `ADX=65.00 (clamped)`, `BREAKOUT_DCA` | ✅ PASS |
| 06 | Monotonic Flash Crash (`-90%` Pure Losses) | `RSI=0.00`, `ADX=65.00`, `SL >= $0.50` floor | ✅ PASS |
| 07 | Symmetric Sawtooth Whip-Saw (`DX = 0`) | `ADX` safely clamped at lower bound `8.00` | ✅ PASS |
| 08 | Micro-Cap Low Price (`$0.60`) | `SL=$0.50` floor respected, `LiqPx=$0.154 > 0` | ✅ PASS |
| 09 | Max Bull Trap (`100%` Retail Bull, `100%` Whale Short) | `D_trap = +3.0000 (+3000 bps)` $\to$ `BULL_TRAP_SHORT` | ✅ PASS |
| 10 | Max Bear Trap (`100%` Retail Bear, `100%` Whale Long, `0` Short) | `D_trap = -3.0000 (-3000 bps)`, `L/S Ratio = 1.0` guard | ✅ PASS |
| 11 | Stage Pitch `BULL_TRAP` (`87%` Bull, `+0.065%` Fund, `-0.60` Whale) | `D_trap = +1.9650 (+1965 bps)` $\to$ `EXECUTE_COUNTER_TRAP_SHORT` | ✅ PASS |
| 12 | Zero Whale Notional (`0` Long / `0` Short) | `wWhale = 0`, `whaleLongShortRatio = 1.0`, `D_trap = 0` | ✅ PASS |
| 13 | Exact Trap Threshold Boundaries (`±1.1000` vs `±1.1015`) | Strict inequality verified (`±1.1000` = `NO_TRAP`) | ✅ PASS |
| 14 | Grid Inner Band Boundaries (`12.0%` & `88.0%`) | `requiresInFlightSurgery = false` (`HOLD_GRID_CORRIDOR`) | ✅ PASS |
| 15 | Grid Lower Drift Breach (`11.9% < 12%`) | `requiresInFlightSurgery = true`, recentered `±2.5*ATR` | ✅ PASS |
| 16 | Grid Upper Drift Breach (`88.1% > 88%` & `93.4%`) | `requiresInFlightSurgery = true`, `AMEND_GRID_IN_FLIGHT` | ✅ PASS |
| 17 | Collapsed Existing Grid (`minPx == maxPx`) | `Math.max(0.0001, span)` prevents `/0` & triggers surgery | ✅ PASS |
| 18 | Liquidation Price Ordering Invariant (`3x` Leverage) | `0 < Liq($18.47) < SL($23.56) < Min($23.98) < Px($24.85)` | ✅ PASS |
| 19 | Macro Bunker Priority (`<=30m` CPI) & `1x` De-Leverage | Overrides Bull Trap to `MACRO_BUNKER`, `LiqPx = $7.4422` | ✅ PASS |
| 20 | `50%` High-Water Mark Profit Sweep (`+$84.60` USDT) | `$42.30` to Simple Earn, `$42.30` to Trading, `HWM = $1084.60` | ✅ PASS |
| 21 | HWM Monotonicity Under Drawdown & Odd-Cent PnL | Negative PnL blocked (`$0` sweep); `$0.01` conserved | ✅ PASS |
| 22 | Malformed Sensor Inputs (`NaN`, `±Infinity`, `0`, `null`) | `safeNum` fallback restores valid finite defaults | ✅ PASS |
| 23 | `1,000`-Iteration Randomized Monte Carlo Fuzzing | `0` `NaN`, `0` `Infinity`, `100%` domain invariant compliance | ✅ PASS |

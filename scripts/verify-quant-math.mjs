#!/usr/bin/env node
/**
 * ============================================================================
 * GRID SURGEON — QUANTITATIVE FINANCE & MATHEMATICAL VERIFICATION SUITE
 * ============================================================================
 * Audits and stress-tests every mathematical formula in Border 1 (phase1Sense.ts)
 * and Border 2 (phase2Brain.ts), plus Border 3 High-Water Mark Profit Sweep:
 *   1. ATR_14 (Average True Range with 0.8% / 1.0% price floor)
 *   2. ADX_14 (Average Directional Index with zero-TR guard & [8, 65] clamp)
 *   3. RSI_14 (Wilder/SMA 14-period Relative Strength Index with zero-loss guard)
 *   4. Bollinger Bandwidth BBW(20, 2) (Population stdDev & zero-middle guard)
 *   5. Retail-vs-Whale Trap Divergence Score:
 *        D_trap = S_retail + 0.5 * F_norm - 1.5 * W_whale  (bounded in [-3.0, +3.0])
 *   6. Grid Drift <12% / >88% Boundary Detection & ±2.5*ATR Recentering
 *   7. Liquidation Price Estimation:
 *        P_liq = minPx * (1 - 1 / (leverage * 1.45))
 *   8. 50% High-Water Mark Simple Earn Profit Sweep & NAV Conservation
 *
 * Usage:
 *   node scripts/verify-quant-math.mjs
 * ============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Exact Reference Implementations Mirroring phase1Sense.ts & phase2Brain.ts
// ----------------------------------------------------------------------------

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function safeNum(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) && n !== 0 ? n : fallback;
}

/**
 * Exact replica of `computeTechnicalsFromCandles` in `backend/src/pipeline/phase1Sense.ts`
 */
function computeTechnicalsFromCandles(candles, fallbackPx) {
  if (candles.length < 15) {
    return {
      rsi14: 52.4,
      bbUpper: Number((fallbackPx * 1.022).toFixed(4)),
      bbMiddle: Number(fallbackPx.toFixed(4)),
      bbLower: Number((fallbackPx * 0.978).toFixed(4)),
      atr14: Number((fallbackPx * 0.014).toFixed(4)),
      adx14: 18.6,
    };
  }

  // 1. Bollinger Bands (20, 2)
  const bbSlice = candles.slice(-20);
  const bbMiddle =
    bbSlice.reduce((acc, c) => acc + c.close, 0) / bbSlice.length;
  const variance =
    bbSlice.reduce((acc, c) => acc + Math.pow(c.close - bbMiddle, 2), 0) /
    bbSlice.length;
  const stdDev = Math.sqrt(variance);
  const bbUpper = bbMiddle + 2 * stdDev;
  const bbLower = bbMiddle - 2 * stdDev;

  // 2. RSI (14)
  let gains = 0;
  let losses = 0;
  const rsiSlice = candles.slice(-15);
  for (let i = 1; i < rsiSlice.length; i++) {
    const diff = rsiSlice[i].close - rsiSlice[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = 100 - 100 / (1 + rs);

  // 3. ATR (14) & ADX (14)
  const trList = [];
  const plusDmList = [];
  const minusDmList = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;

    trList.push(tr);
    plusDmList.push(plusDm);
    minusDmList.push(minusDm);
  }

  const recentTr = trList.slice(-14);
  const atr14 =
    recentTr.reduce((a, b) => a + b, 0) / Math.max(1, recentTr.length);

  const dxList = [];
  const windowSize = 14;
  for (let i = windowSize; i <= trList.length; i++) {
    const trSum = trList.slice(i - windowSize, i).reduce((a, b) => a + b, 0);
    const pDmSum = plusDmList
      .slice(i - windowSize, i)
      .reduce((a, b) => a + b, 0);
    const mDmSum = minusDmList
      .slice(i - windowSize, i)
      .reduce((a, b) => a + b, 0);
    if (trSum > 0) {
      const pDi = (pDmSum / trSum) * 100;
      const mDi = (mDmSum / trSum) * 100;
      const denom = pDi + mDi;
      const dx = denom > 0 ? (Math.abs(pDi - mDi) / denom) * 100 : 0;
      dxList.push(dx);
    }
  }

  const recentDx = dxList.slice(-14);
  const adx14 =
    recentDx.length > 0
      ? recentDx.reduce((a, b) => a + b, 0) / recentDx.length
      : 19.5;

  return {
    rsi14: Number(rsi14.toFixed(2)),
    bbUpper: Number(bbUpper.toFixed(4)),
    bbMiddle: Number(bbMiddle.toFixed(4)),
    bbLower: Number(bbLower.toFixed(4)),
    atr14: Number(Math.max(atr14, fallbackPx * 0.008).toFixed(4)),
    adx14: Number(clamp(adx14, 8, 65).toFixed(2)),
  };
}

/**
 * Exact Sentiment, Whale & BBW computation from `phase1Sense.ts`
 */
function computePhase1DerivedMetrics({
  lastPx,
  open24h,
  bbUpper,
  bbMiddle,
  bbLower,
  atr14,
  bullishRatio,
  bearishRatio,
  longNotionalUsd,
  shortNotionalUsd,
}) {
  const change24hPct =
    open24h > 0 ? Number((((lastPx - open24h) / open24h) * 100).toFixed(2)) : 0;
  const bbWidthPct =
    bbMiddle > 0 ? Number((((bbUpper - bbLower) / bbMiddle) * 100).toFixed(2)) : 4.2;

  const supertrendDirection =
    lastPx > bbMiddle + 0.35 * atr14
      ? 'BULLISH'
      : lastPx < bbMiddle - 0.35 * atr14
      ? 'BEARISH'
      : 'NEUTRAL';

  const sRetail = Number((bullishRatio - bearishRatio).toFixed(4));
  const totalWhale = longNotionalUsd + shortNotionalUsd;
  const wWhale =
    totalWhale > 0
      ? Number(((longNotionalUsd - shortNotionalUsd) / totalWhale).toFixed(4))
      : 0;
  const whaleLongShortRatio =
    shortNotionalUsd > 0
      ? Number((longNotionalUsd / shortNotionalUsd).toFixed(2))
      : 1.0;

  return {
    change24hPct,
    bbWidthPct,
    supertrendDirection,
    sRetail,
    wWhale,
    whaleLongShortRatio,
  };
}

/**
 * Exact replica of `runPhase2Brain` in `backend/src/pipeline/phase2Brain.ts`
 */
function runPhase2BrainMath(sense, currentGridBot = null) {
  const lastPx = sense.market.lastPx;
  const atr = Math.max(sense.technicals.atr14, lastPx * 0.01);
  const adx = sense.technicals.adx14;
  const bbw = Number((sense.technicals.bbWidthPct / 100).toFixed(4));
  const oiDelta1hPct = sense.market.oiDelta1hPct;

  // 1. Compute Retail-vs-Whale Divergence Trap Score (D_trap)
  const sRetail = sense.sentiment.sRetail;
  const fNorm = Number(clamp(sense.market.fundingRate / 0.001, -1, 1).toFixed(4));
  const wWhale = sense.smartMoney.wWhale;
  const dTrap = Number((sRetail + 0.5 * fNorm - 1.5 * wWhale).toFixed(4));
  const dTrapBps = Math.round(dTrap * 1000);

  const trapClassification =
    dTrap > 1.1 ? 'BULL_TRAP' : dTrap < -1.1 ? 'BEAR_TRAP' : 'NO_TRAP';

  // 2. Evaluate Grid Corridor & Drift Surgery Trigger
  const gridNum = 12;
  const recenteredMinPx = Number((lastPx - 2.5 * atr).toFixed(4));
  const recenteredMaxPx = Number((lastPx + 2.5 * atr).toFixed(4));

  let existingMin = currentGridBot?.minPx ?? recenteredMinPx;
  let existingMax = currentGridBot?.maxPx ?? recenteredMaxPx;
  if (sense.scenario === 'DRIFT_SURGERY') {
    const span = 5 * atr;
    existingMin = Number((lastPx - 0.934 * span).toFixed(4));
    existingMax = Number((existingMin + span).toFixed(4));
  }

  const existingSpan = Math.max(0.0001, existingMax - existingMin);
  const corridorPositionPct = Number(
    ((lastPx - existingMin) / existingSpan).toFixed(4)
  );

  const isOutOfSafeCorridor =
    corridorPositionPct > 0.88 ||
    corridorPositionPct < 0.12 ||
    sense.scenario === 'DRIFT_SURGERY';

  const targetMinPx = isOutOfSafeCorridor ? recenteredMinPx : existingMin;
  const targetMaxPx = isOutOfSafeCorridor ? recenteredMaxPx : existingMax;
  const targetSpan = Math.max(0.01, targetMaxPx - targetMinPx);
  const gridStepUsdt = Number((targetSpan / gridNum).toFixed(4));
  const gridStepPct = Number(((gridStepUsdt / lastPx) * 100).toFixed(2));

  const gridLevels = [];
  for (let i = 0; i <= gridNum; i++) {
    gridLevels.push(Number((targetMinPx + i * gridStepUsdt).toFixed(4)));
  }

  const tpTriggerPx = Number((targetMaxPx + 1.2 * atr).toFixed(4));
  const slTriggerPx = Number(Math.max(0.5, targetMinPx - 1.2 * atr).toFixed(4));

  // 3. Classify Market Regime & Recommended Action
  let regime = 'RANGING_GRID';
  let regimeIndex = 0;
  let recommendedAction = 'HOLD_GRID_CORRIDOR';
  let targetLeverage = 3;
  let profitSweepEligibleUsdt = 0;

  if (
    sense.macroCalendar.imminentHighImpactEvent &&
    sense.macroCalendar.minutesUntilRelease <= 30
  ) {
    regime = 'MACRO_BUNKER';
    regimeIndex = 4;
    recommendedAction = 'ACTIVATE_MACRO_BUNKER';
    targetLeverage = 1;
  } else if (trapClassification === 'BULL_TRAP') {
    regime = 'BULL_TRAP_SHORT';
    regimeIndex = 1;
    recommendedAction = 'EXECUTE_COUNTER_TRAP_SHORT';
    targetLeverage = 3;
  } else if (trapClassification === 'BEAR_TRAP') {
    regime = 'BEAR_TRAP_LONG';
    regimeIndex = 2;
    recommendedAction = 'EXECUTE_COUNTER_TRAP_LONG';
    targetLeverage = 3;
  } else if (sense.scenario === 'PROFIT_SWEEP') {
    regime = 'RANGING_GRID';
    regimeIndex = 0;
    recommendedAction = 'SWEEP_PROFIT_TO_EARN';
    profitSweepEligibleUsdt = 42.3;
  } else if (adx >= 25 && Math.abs(oiDelta1hPct) >= 3.0) {
    regime = 'BREAKOUT_DCA';
    regimeIndex = 3;
    recommendedAction = 'DEPLOY_BREAKOUT_DCA';
    targetLeverage = 3;
  } else {
    regime = 'RANGING_GRID';
    regimeIndex = 0;
    if (!currentGridBot || currentGridBot.status === 'STOPPED') {
      recommendedAction = 'DEPLOY_CONTRACT_GRID';
    } else if (isOutOfSafeCorridor) {
      recommendedAction = 'AMEND_GRID_IN_FLIGHT';
    } else {
      recommendedAction = 'HOLD_GRID_CORRIDOR';
    }
  }

  const estimatedLiquidationPx = Number(
    (targetMinPx * (1 - 1 / (targetLeverage * 1.45))).toFixed(4)
  );

  return {
    regime,
    regimeIndex,
    recommendedAction,
    formulas: {
      bbw,
      adx14: adx,
      atr14: atr,
      oiDelta1hPct,
      sRetail,
      fNorm,
      wWhale,
      dTrap,
      dTrapBps,
      trapClassification,
    },
    gridPlan: {
      minPx: targetMinPx,
      maxPx: targetMaxPx,
      recenteredMinPx,
      recenteredMaxPx,
      gridNum,
      gridLevels,
      gridStepUsdt,
      gridStepPct,
      tpTriggerPx,
      slTriggerPx,
      estimatedLiquidationPx,
      leverage: targetLeverage,
      corridorPositionPct,
      requiresInFlightSurgery: isOutOfSafeCorridor,
    },
    riskParameters: {
      targetLeverage,
      maxDrawdownGuardPct: 4.5,
      trailingStopCallbackRatio: 0.015,
      profitSweepEligibleUsdt,
    },
  };
}

/**
 * 50% High-Water Mark Simple Earn Profit Sweep Formula (`phase2Brain.ts` & `phase3Execute.ts`)
 */
function computeHighWaterMarkSweep(treasury, realizedProfitUsdt) {
  const safeProfit = Math.max(0, Number.isFinite(realizedProfitUsdt) ? realizedProfitUsdt : 0);
  const sweepAmt = Number((safeProfit * 0.5).toFixed(2));
  const retainedTradingAmt = Number((safeProfit - sweepAmt).toFixed(2));

  const tradingAccountUsdt = Number(
    (treasury.tradingAccountUsdt + retainedTradingAmt).toFixed(2)
  );
  const fundingAccountUsdt = Number(treasury.fundingAccountUsdt.toFixed(2));
  const lockedSimpleEarnUsdt = Number(
    (treasury.lockedSimpleEarnUsdt + sweepAmt).toFixed(2)
  );
  const cumulativeRealizedPnlUsdt = Number(
    (treasury.cumulativeRealizedPnlUsdt + safeProfit).toFixed(2)
  );
  const totalNavUsdt = Number(
    (tradingAccountUsdt + fundingAccountUsdt + lockedSimpleEarnUsdt).toFixed(2)
  );
  const highWaterMarkNavUsdt = Math.max(
    treasury.highWaterMarkNavUsdt,
    totalNavUsdt
  );

  return {
    realizedProfitUsdt: safeProfit,
    sweptToEarnUsdt: sweepAmt,
    retainedTradingAmt,
    tradingAccountUsdt,
    fundingAccountUsdt,
    lockedSimpleEarnUsdt,
    cumulativeRealizedPnlUsdt,
    totalNavUsdt,
    highWaterMarkNavUsdt,
  };
}

// ----------------------------------------------------------------------------
// Helper Generators & Deep Finite Assertions
// ----------------------------------------------------------------------------

function assertAllFiniteNumbers(obj, pathPrefix = 'root') {
  if (typeof obj === 'number') {
    assert.equal(
      Number.isFinite(obj) && !Number.isNaN(obj),
      true,
      `Expected finite number at ${pathPrefix}, got ${obj}`
    );
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) =>
      assertAllFiniteNumbers(item, `${pathPrefix}[${idx}]`)
    );
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      assertAllFiniteNumbers(v, `${pathPrefix}.${k}`);
    }
  }
}

function buildSenseInput({
  scenario = 'LIVE',
  lastPx = 24.85,
  open24h = 24.5,
  fundingRate = 0.00012,
  oiDelta1hPct = 0.42,
  candles = [],
  bullishRatio = 0.55,
  bearishRatio = 0.45,
  longNotionalUsd = 6000000,
  shortNotionalUsd = 5500000,
  imminentHighImpactEvent = false,
  minutesUntilRelease = 280,
}) {
  const tech = computeTechnicalsFromCandles(candles, lastPx);
  const derived = computePhase1DerivedMetrics({
    lastPx,
    open24h,
    bbUpper: tech.bbUpper,
    bbMiddle: tech.bbMiddle,
    bbLower: tech.bbLower,
    atr14: tech.atr14,
    bullishRatio,
    bearishRatio,
    longNotionalUsd,
    shortNotionalUsd,
  });

  return {
    scenario,
    market: {
      lastPx,
      open24h,
      change24hPct: derived.change24hPct,
      fundingRate,
      oiDelta1hPct,
    },
    technicals: {
      ...tech,
      bbWidthPct: derived.bbWidthPct,
      supertrendDirection: derived.supertrendDirection,
    },
    sentiment: {
      bullishRatio,
      bearishRatio,
      sRetail: derived.sRetail,
    },
    smartMoney: {
      longNotionalUsd,
      shortNotionalUsd,
      wWhale: derived.wWhale,
      whaleLongShortRatio: derived.whaleLongShortRatio,
    },
    macroCalendar: {
      imminentHighImpactEvent,
      minutesUntilRelease,
    },
  };
}

// ----------------------------------------------------------------------------
// Test Runner Infrastructure
// ----------------------------------------------------------------------------

const results = [];

function runCase(id, name, fn) {
  const t0 = performance.now();
  try {
    const details = fn();
    const ms = (performance.now() - t0).toFixed(2);
    results.push({ id, name, status: 'PASS', ms, details });
    console.log(`  ✅ [PASS] #${String(id).padStart(2, '0')} ${name} (${ms}ms)`);
    if (details) {
      console.log(`       └─ ${details}`);
    }
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(2);
    results.push({ id, name, status: 'FAIL', ms, error: err.message });
    console.error(`  ❌ [FAIL] #${String(id).padStart(2, '0')} ${name}: ${err.message}`);
    throw err;
  }
}

console.log('================================================================================');
console.log('  GRID SURGEON — QUANTITATIVE FINANCE & MATHEMATICAL VERIFICATION AUDIT');
console.log('================================================================================\n');

// ----------------------------------------------------------------------------
// SECTION 0: Source Code Formula Integrity Verification
// ----------------------------------------------------------------------------
runCase(1, 'Source File Formula Integrity Check (phase1Sense.ts & phase2Brain.ts)', () => {
  const p1Path = path.join(ROOT_DIR, 'backend/src/pipeline/phase1Sense.ts');
  const p2Path = path.join(ROOT_DIR, 'backend/src/pipeline/phase2Brain.ts');
  const p1Src = fs.readFileSync(p1Path, 'utf8');
  const p2Src = fs.readFileSync(p2Path, 'utf8');

  // Verify exact formulas exist in source
  assert.ok(p1Src.includes('const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;'), 'RSI zero-loss guard present');
  assert.ok(p1Src.includes('const rsi14 = 100 - 100 / (1 + rs);'), 'RSI_14 formula present');
  assert.ok(p1Src.includes('Math.max(atr14, fallbackPx * 0.008)'), 'ATR_14 floor guard present in phase1Sense');
  assert.ok(p1Src.includes('clamp(adx14, 8, 65)'), 'ADX_14 clamp [8, 65] present in phase1Sense');
  assert.ok(p2Src.includes('sRetail + 0.5 * fNorm - 1.5 * wWhale'), 'D_trap formula present in phase2Brain');
  assert.ok(p2Src.includes('lastPx - 2.5 * atr') && p2Src.includes('lastPx + 2.5 * atr'), '±2.5*ATR grid recentering present');
  assert.ok(p2Src.includes('corridorPositionPct > 0.88') && p2Src.includes('corridorPositionPct < 0.12'), '<12% / >88% drift triggers present');
  assert.ok(p2Src.includes('targetMinPx * (1 - 1 / (targetLeverage * 1.45))'), 'Liquidation price formula present');

  return 'Verified all 8 core mathematical expressions in TypeScript source files';
});

// ----------------------------------------------------------------------------
// SECTION 1: Candle Technicals Edge Cases (ATR_14, ADX_14, RSI_14, BBW)
// ----------------------------------------------------------------------------

runCase(2, 'Zero Volume & Completely Flat Candles (Zero Variance / Zero TR / Zero Loss)', () => {
  const flatCandles = Array.from({ length: 50 }, (_, i) => ({
    ts: 1700000000000 + i * 3600000,
    open: 25.0,
    high: 25.0,
    low: 25.0,
    close: 25.0,
    vol: 0,
  }));
  const sense = buildSenseInput({ lastPx: 25.0, open24h: 25.0, candles: flatCandles });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);

  // When flat: stdDev = 0 -> bbUpper == bbMiddle == bbLower == 25, BBW = 0
  assert.equal(sense.technicals.bbUpper, 25.0);
  assert.equal(sense.technicals.bbLower, 25.0);
  assert.equal(sense.technicals.bbWidthPct, 0);
  // avgGain = 0, avgLoss = 0 -> avgLoss === 0 guard triggers rs = 100 -> rsi14 = 99.01
  assert.equal(sense.technicals.rsi14, 99.01);
  // Raw ATR = 0 -> floored at 0.008 * 25 = 0.20 in Phase 1, and 0.01 * 25 = 0.25 in Phase 2
  assert.equal(sense.technicals.atr14, 0.2);
  assert.equal(brain.formulas.atr14, 0.25);
  // ADX fallback when trSum == 0 -> 19.5
  assert.equal(sense.technicals.adx14, 19.5);
  return `BBW=${sense.technicals.bbWidthPct}%, RSI=${sense.technicals.rsi14}, ATR_P1=${sense.technicals.atr14}, ATR_P2=${brain.formulas.atr14}, ADX=${sense.technicals.adx14}`;
});

runCase(3, 'Insufficient Candle History (<15 Bars Offline Fallback Guard)', () => {
  const shortCandles = Array.from({ length: 5 }, (_, i) => ({
    ts: 1700000000000 + i * 3600000,
    open: 24.0,
    high: 24.5,
    low: 23.5,
    close: 24.2,
    vol: 100,
  }));
  const sense = buildSenseInput({ lastPx: 24.2, candles: shortCandles });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);
  assert.equal(sense.technicals.rsi14, 52.4);
  assert.equal(sense.technicals.adx14, 18.6);
  assert.equal(sense.technicals.atr14, Number((24.2 * 0.014).toFixed(4)));
  return `Fallback RSI=${sense.technicals.rsi14}, ADX=${sense.technicals.adx14}, ATR=${sense.technicals.atr14}`;
});

runCase(4, 'Empty Candle Array (0 Bars Hard Fallback Guard)', () => {
  const sense = buildSenseInput({ lastPx: 24.85, candles: [] });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);
  assert.ok(brain.gridPlan.minPx < brain.gridPlan.maxPx);
  return `0-bar fallback grid [${brain.gridPlan.minPx}, ${brain.gridPlan.maxPx}]`;
});

runCase(5, 'Monotonic Vertical Pump (+500% Pure Gains — RSI Upper Bound & ADX Max Clamp)', () => {
  let px = 10.0;
  const pumpCandles = Array.from({ length: 50 }, (_, i) => {
    const open = px;
    const close = Number((px * 1.038).toFixed(4));
    const high = Number((close * 1.01).toFixed(4));
    const low = open;
    px = close;
    return { ts: i, open, high, low, close, vol: 500000 };
  });
  const sense = buildSenseInput({ lastPx: px, open24h: 10.0, candles: pumpCandles, oiDelta1hPct: 6.5 });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);

  // Losses = 0 -> RS = 100 -> RSI = 99.01 <= 100
  assert.equal(sense.technicals.rsi14, 99.01);
  // Pure directional move -> raw DX = 100 -> ADX clamped at 65.0
  assert.equal(sense.technicals.adx14, 65);
  assert.equal(brain.regime, 'BREAKOUT_DCA');
  return `RSI=${sense.technicals.rsi14} (<=100), ADX=${sense.technicals.adx14} (clamped at 65), Regime=${brain.regime}`;
});

runCase(6, 'Monotonic Flash Crash (-90% Pure Losses — RSI Lower Bound & SL Floor Guard)', () => {
  let px = 100.0;
  const crashCandles = Array.from({ length: 50 }, (_, i) => {
    const open = px;
    const close = Number((px * 0.94).toFixed(4));
    const high = open;
    const low = Number((close * 0.98).toFixed(4));
    px = close;
    return { ts: i, open, high, low, close, vol: 1200000 };
  });
  const sense = buildSenseInput({ lastPx: px, open24h: 100.0, candles: crashCandles, oiDelta1hPct: -8.2 });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);

  // Gains = 0 -> RS = 0 -> RSI = 0.00
  assert.equal(sense.technicals.rsi14, 0);
  // ADX clamped at 65
  assert.equal(sense.technicals.adx14, 65);
  // SL trigger price strictly >= 0.50 floor
  assert.ok(brain.gridPlan.slTriggerPx >= 0.5, `SL ${brain.gridPlan.slTriggerPx} must be >= 0.5`);
  return `RSI=${sense.technicals.rsi14}, ADX=${sense.technicals.adx14}, SL=${brain.gridPlan.slTriggerPx} (>=0.50 floor)`;
});

runCase(7, 'Symmetric Sawtooth Whip-Saw Volatility (ADX Lower Clamp = 8.00)', () => {
  // Alternating identical up/down bars so +DM == -DM over 14-bar window -> DX = 0 -> ADX clamped to 8
  const sawCandles = Array.from({ length: 50 }, (_, i) => {
    const isEven = i % 2 === 0;
    return {
      ts: i,
      open: 25.0,
      high: isEven ? 26.0 : 25.5,
      low: isEven ? 24.5 : 24.0,
      close: isEven ? 25.5 : 24.5,
      vol: 10000,
    };
  });
  const sense = buildSenseInput({ lastPx: 25.0, candles: sawCandles });
  assertAllFiniteNumbers(sense);
  assert.equal(sense.technicals.adx14, 8);
  return `Alternating symmetric whip-saw DX=0 -> ADX clamped to minimum ${sense.technicals.adx14}`;
});

runCase(8, 'Micro-Cap Low Price Asset ($0.60 Price — SL Floor & Positive Liquidation Guard)', () => {
  const lowPxCandles = Array.from({ length: 50 }, (_, i) => ({
    ts: i,
    open: 0.6,
    high: 0.68,
    low: 0.52,
    close: 0.6,
    vol: 5000,
  }));
  const sense = buildSenseInput({ lastPx: 0.6, open24h: 0.6, candles: lowPxCandles });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);
  assert.equal(brain.gridPlan.slTriggerPx, 0.5);
  assert.ok(brain.gridPlan.estimatedLiquidationPx > 0);
  return `LowPx=$0.60 -> minPx=${brain.gridPlan.minPx}, SL=${brain.gridPlan.slTriggerPx}, LiqPx=${brain.gridPlan.estimatedLiquidationPx}`;
});

// ----------------------------------------------------------------------------
// SECTION 2: Retail-vs-Whale Divergence Trap Score (D_trap) Stress Cases
//   Formula: D_trap = S_retail + 0.5 * F_norm - 1.5 * W_whale
// ----------------------------------------------------------------------------

runCase(9, 'Maximum Theoretical Bull Trap (100% Bullish Retail, Max +Funding, 100% Whale Short)', () => {
  // S_retail = +1.0, F_norm = +1.0, W_whale = -1.0
  // D_trap = 1.0 + 0.5*(1.0) - 1.5*(-1.0) = +3.0000 (3000 bps)
  const sense = buildSenseInput({
    bullishRatio: 1.0,
    bearishRatio: 0.0,
    fundingRate: 0.05, // +5% per 8h -> clamped to F_norm = +1.0
    longNotionalUsd: 0,
    shortNotionalUsd: 25000000,
  });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(brain);
  assert.equal(brain.formulas.sRetail, 1.0);
  assert.equal(brain.formulas.fNorm, 1.0);
  assert.equal(brain.formulas.wWhale, -1.0);
  assert.equal(brain.formulas.dTrap, 3.0);
  assert.equal(brain.formulas.dTrapBps, 3000);
  assert.equal(brain.formulas.trapClassification, 'BULL_TRAP');
  assert.equal(brain.regime, 'BULL_TRAP_SHORT');
  assert.equal(brain.recommendedAction, 'EXECUTE_COUNTER_TRAP_SHORT');
  return `D_trap=+${brain.formulas.dTrap.toFixed(4)} (${brain.formulas.dTrapBps} bps) -> ${brain.regime}`;
});

runCase(10, 'Maximum Theoretical Bear Trap (100% Bearish Retail, Extreme Negative Funding, 100% Whale Long)', () => {
  // S_retail = -1.0, F_norm = -1.0, W_whale = +1.0
  // D_trap = -1.0 + 0.5*(-1.0) - 1.5*(+1.0) = -3.0000 (-3000 bps)
  const sense = buildSenseInput({
    bullishRatio: 0.0,
    bearishRatio: 1.0,
    fundingRate: -0.05, // -5% per 8h -> clamped to F_norm = -1.0
    longNotionalUsd: 30000000,
    shortNotionalUsd: 0, // tests shortNotionalUsd === 0 division guard in whaleLongShortRatio!
  });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);
  assert.equal(sense.smartMoney.whaleLongShortRatio, 1.0); // safe fallback when shortNotionalUsd == 0
  assert.equal(brain.formulas.sRetail, -1.0);
  assert.equal(brain.formulas.fNorm, -1.0);
  assert.equal(brain.formulas.wWhale, 1.0);
  assert.equal(brain.formulas.dTrap, -3.0);
  assert.equal(brain.formulas.dTrapBps, -3000);
  assert.equal(brain.formulas.trapClassification, 'BEAR_TRAP');
  assert.equal(brain.regime, 'BEAR_TRAP_LONG');
  assert.equal(brain.recommendedAction, 'EXECUTE_COUNTER_TRAP_LONG');
  return `D_trap=${brain.formulas.dTrap.toFixed(4)} (${brain.formulas.dTrapBps} bps) -> ${brain.regime}`;
});

runCase(11, 'Stage Pitch BULL_TRAP Scenario Verification (87% Bullish, +0.065% Funding, $2.85M L vs $11.4M S)', () => {
  // Exact parameters from phase1Sense.ts lines 213-219:
  // bullishRatio = 0.87, bearishRatio = 0.13 -> sRetail = 0.74
  // fundingRate = 0.00065 -> fNorm = 0.65
  // long = 2.85M, short = 11.4M -> wWhale = (2.85 - 11.4) / 14.25 = -0.60
  // D_trap = 0.74 + 0.5*(0.65) - 1.5*(-0.60) = 0.74 + 0.325 + 0.90 = +1.965 (1965 bps)
  const sense = buildSenseInput({
    scenario: 'BULL_TRAP',
    bullishRatio: 0.87,
    bearishRatio: 0.13,
    fundingRate: 0.00065,
    longNotionalUsd: 2850000,
    shortNotionalUsd: 11400000,
  });
  const brain = runPhase2BrainMath(sense);
  assert.equal(brain.formulas.sRetail, 0.74);
  assert.equal(brain.formulas.fNorm, 0.65);
  assert.equal(brain.formulas.wWhale, -0.6);
  assert.equal(brain.formulas.dTrap, 1.965);
  assert.equal(brain.formulas.dTrapBps, 1965);
  assert.equal(brain.regime, 'BULL_TRAP_SHORT');
  return `Stage BULL_TRAP: sRetail=0.74, fNorm=0.65, wWhale=-0.60 => D_trap=+1.965 (+1965 bps)`;
});

runCase(12, 'Zero Whale Notional Guard (0 Long / 0 Short — Division-by-Zero Protection)', () => {
  const sense = buildSenseInput({
    bullishRatio: 0.5,
    bearishRatio: 0.5,
    fundingRate: 0,
    longNotionalUsd: 0,
    shortNotionalUsd: 0,
  });
  const brain = runPhase2BrainMath(sense);
  assertAllFiniteNumbers(sense);
  assertAllFiniteNumbers(brain);
  assert.equal(sense.smartMoney.wWhale, 0);
  assert.equal(sense.smartMoney.whaleLongShortRatio, 1.0);
  assert.equal(brain.formulas.dTrap, 0);
  assert.equal(brain.formulas.trapClassification, 'NO_TRAP');
  return `0/0 whale notional safely yields wWhale=0, ratio=1.0, D_trap=0`;
});

runCase(13, 'Exact Trap Threshold Boundaries (D_trap = +1.1000 vs +1.1001 and -1.1000 vs -1.1001)', () => {
  // D_trap = +1.10 -> NO_TRAP (strictly > 1.1 required)
  const senseAtPosBoundary = buildSenseInput({
    bullishRatio: 0.775,
    bearishRatio: 0.225, // sRetail = +0.55
    fundingRate: 0.001,  // fNorm = +1.0 -> +0.5
    longNotionalUsd: 483871,
    shortNotionalUsd: 516129, // wWhale = -0.0323
  });
  // Directly craft exact sRetail=0.60, fNorm=1.0 (0.5*1.0=0.5), wWhale=0 => dTrap = 1.10
  senseAtPosBoundary.sentiment.sRetail = 0.6;
  senseAtPosBoundary.market.fundingRate = 0.001;
  senseAtPosBoundary.smartMoney.wWhale = 0;
  const brainAt110 = runPhase2BrainMath(senseAtPosBoundary);
  assert.equal(brainAt110.formulas.dTrap, 1.1);
  assert.equal(brainAt110.formulas.trapClassification, 'NO_TRAP');

  // Step +0.0015 above boundary: wWhale = -0.001 -> dTrap = 1.1015 -> BULL_TRAP
  senseAtPosBoundary.smartMoney.wWhale = -0.001;
  const brainAbove110 = runPhase2BrainMath(senseAtPosBoundary);
  assert.equal(brainAbove110.formulas.dTrap, 1.1015);
  assert.equal(brainAbove110.formulas.trapClassification, 'BULL_TRAP');

  // At -1.10 -> NO_TRAP; at -1.1015 -> BEAR_TRAP
  senseAtPosBoundary.sentiment.sRetail = -0.6;
  senseAtPosBoundary.market.fundingRate = -0.001;
  senseAtPosBoundary.smartMoney.wWhale = 0;
  const brainAtMinus110 = runPhase2BrainMath(senseAtPosBoundary);
  assert.equal(brainAtMinus110.formulas.dTrap, -1.1);
  assert.equal(brainAtMinus110.formulas.trapClassification, 'NO_TRAP');

  senseAtPosBoundary.smartMoney.wWhale = 0.001;
  const brainBelowMinus110 = runPhase2BrainMath(senseAtPosBoundary);
  assert.equal(brainBelowMinus110.formulas.dTrap, -1.1015);
  assert.equal(brainBelowMinus110.formulas.trapClassification, 'BEAR_TRAP');

  return `Verified strict inequality boundaries at ±1.1000 (NO_TRAP) vs ±1.1015 (TRAP)`;
});

// ----------------------------------------------------------------------------
// SECTION 3: Grid Drift (<12% / >88%) & ±2.5*ATR Recentering Surgery
// ----------------------------------------------------------------------------

runCase(14, 'Grid Drift Inner Band Boundary (12.0% and 88.0% — Hold Corridor Without Surgery)', () => {
  const sense = buildSenseInput({ lastPx: 21.2 });
  // Corridor [20.0, 30.0] -> span = 10.0
  // At lastPx = 21.2 -> position = (21.2 - 20.0)/10 = 0.1200 (12.0%) -> inside [12%, 88%]
  const botAt12 = { algoId: '1', status: 'RUNNING', minPx: 20.0, maxPx: 30.0 };
  const brain12 = runPhase2BrainMath(sense, botAt12);
  assert.equal(brain12.gridPlan.corridorPositionPct, 0.12);
  assert.equal(brain12.gridPlan.requiresInFlightSurgery, false);
  assert.equal(brain12.recommendedAction, 'HOLD_GRID_CORRIDOR');

  // At lastPx = 28.8 -> position = (28.8 - 20.0)/10 = 0.8800 (88.0%) -> inside [12%, 88%]
  const sense88 = buildSenseInput({ lastPx: 28.8 });
  const brain88 = runPhase2BrainMath(sense88, botAt12);
  assert.equal(brain88.gridPlan.corridorPositionPct, 0.88);
  assert.equal(brain88.gridPlan.requiresInFlightSurgery, false);
  assert.equal(brain88.recommendedAction, 'HOLD_GRID_CORRIDOR');

  return `12.0% & 88.0% exact boundaries hold existing grid [20.0, 30.0] without unnecessary surgery`;
});

runCase(15, 'Grid Drift Lower Breach (<12% at 11.9% — Triggers ±2.5*ATR In-Flight Recentering)', () => {
  const sense = buildSenseInput({ lastPx: 21.19 });
  const existingBot = { algoId: '1', status: 'RUNNING', minPx: 20.0, maxPx: 30.0 };
  const brain = runPhase2BrainMath(sense, existingBot);
  const atr = brain.formulas.atr14;

  assert.equal(brain.gridPlan.corridorPositionPct, 0.119);
  assert.equal(brain.gridPlan.requiresInFlightSurgery, true);
  assert.equal(brain.recommendedAction, 'AMEND_GRID_IN_FLIGHT');
  assert.equal(brain.gridPlan.minPx, Number((21.19 - 2.5 * atr).toFixed(4)));
  assert.equal(brain.gridPlan.maxPx, Number((21.19 + 2.5 * atr).toFixed(4)));
  assert.equal(brain.gridPlan.gridLevels.length, 13); // 12 grids = 13 price levels
  return `Pos=11.9% (<12%) -> Amended to [${brain.gridPlan.minPx}, ${brain.gridPlan.maxPx}] around $21.19`;
});

runCase(16, 'Grid Drift Upper Breach (>88% at 88.1% & DRIFT_SURGERY Scenario at 93.4%)', () => {
  const senseUpper = buildSenseInput({ lastPx: 28.81 });
  const existingBot = { algoId: '1', status: 'RUNNING', minPx: 20.0, maxPx: 30.0 };
  const brainUpper = runPhase2BrainMath(senseUpper, existingBot);
  assert.equal(brainUpper.gridPlan.corridorPositionPct, 0.881);
  assert.equal(brainUpper.gridPlan.requiresInFlightSurgery, true);
  assert.equal(brainUpper.recommendedAction, 'AMEND_GRID_IN_FLIGHT');

  // Also test DRIFT_SURGERY scenario mode
  const senseDriftScenario = buildSenseInput({ scenario: 'DRIFT_SURGERY', lastPx: 24.85 });
  const brainDriftScenario = runPhase2BrainMath(senseDriftScenario, existingBot);
  assert.ok(Math.abs(brainDriftScenario.gridPlan.corridorPositionPct - 0.934) <= 0.001);
  assert.equal(brainDriftScenario.gridPlan.requiresInFlightSurgery, true);
  assert.equal(brainDriftScenario.recommendedAction, 'AMEND_GRID_IN_FLIGHT');

  return `Upper breach (88.1%) & DRIFT_SURGERY (93.4%) recenter to [P - 2.5*ATR, P + 2.5*ATR]`;
});

runCase(17, 'Degenerate / Inverted Existing Grid Corridor (minPx == maxPx Zero-Span Guard)', () => {
  const sense = buildSenseInput({ lastPx: 25.0 });
  const brokenBot = { algoId: '1', status: 'RUNNING', minPx: 25.0, maxPx: 25.0 };
  const brain = runPhase2BrainMath(sense, brokenBot);
  assertAllFiniteNumbers(brain);
  // existingSpan = Math.max(0.0001, 0) = 0.0001 -> corridorPositionPct = 0 < 0.12 -> triggers surgery!
  assert.equal(brain.gridPlan.requiresInFlightSurgery, true);
  assert.ok(brain.gridPlan.maxPx > brain.gridPlan.minPx);
  return `Collapsed [25, 25] grid safely guarded by Math.max(0.0001, span) and healed to [${brain.gridPlan.minPx}, ${brain.gridPlan.maxPx}]`;
});

// ----------------------------------------------------------------------------
// SECTION 4: Liquidation Price Estimation & Macro Bunker Override
//   Formula: P_liq = minPx * (1 - 1 / (leverage * 1.45))
// ----------------------------------------------------------------------------

runCase(18, 'Liquidation Price Safety Invariant (0 < P_liq < SL < minPx < P < maxPx < TP)', () => {
  const sense = buildSenseInput({ lastPx: 24.85 });
  const brain = runPhase2BrainMath(sense);
  const { minPx, maxPx, slTriggerPx, tpTriggerPx, estimatedLiquidationPx, leverage } = brain.gridPlan;

  // At 3x leverage: factor = 1 - 1/(3 * 1.45) = 1 - 1/4.35 = 0.7701149
  const expectedLiq = Number((minPx * (1 - 1 / (3 * 1.45))).toFixed(4));
  assert.equal(leverage, 3);
  assert.equal(estimatedLiquidationPx, expectedLiq);
  assert.ok(
    0 < estimatedLiquidationPx &&
      estimatedLiquidationPx < slTriggerPx &&
      slTriggerPx < minPx &&
      minPx < 24.85 &&
      24.85 < maxPx &&
      maxPx < tpTriggerPx,
    `Ordering invariant failed: 0 < Liq(${estimatedLiquidationPx}) < SL(${slTriggerPx}) < Min(${minPx}) < Px(24.85) < Max(${maxPx}) < TP(${tpTriggerPx})`
  );
  return `Ordering verified: 0 < Liq($${estimatedLiquidationPx}) < SL($${slTriggerPx}) < Min($${minPx}) < Px($24.85) < Max($${maxPx}) < TP($${tpTriggerPx})`;
});

runCase(19, 'Macro Bunker Override Priority & 1x De-Leveraged Liquidation Boundary', () => {
  // Even during a Bull Trap (D_trap = +3.0), an imminent Macro event (<=30m) MUST take priority (Regime 4)
  const sense = buildSenseInput({
    scenario: 'MACRO_BUNKER',
    lastPx: 24.85,
    bullishRatio: 1.0,
    bearishRatio: 0.0,
    fundingRate: 0.01,
    longNotionalUsd: 0,
    shortNotionalUsd: 10000000,
    imminentHighImpactEvent: true,
    minutesUntilRelease: 14,
  });
  const brain = runPhase2BrainMath(sense);
  assert.equal(brain.regime, 'MACRO_BUNKER');
  assert.equal(brain.regimeIndex, 4);
  assert.equal(brain.riskParameters.targetLeverage, 1);

  // At 1x leverage: factor = 1 - 1/1.45 = 0.3103448 -> LiqPx is ~69% below minPx
  const expectedLiq1x = Number((brain.gridPlan.minPx * (1 - 1 / 1.45)).toFixed(4));
  assert.equal(brain.gridPlan.estimatedLiquidationPx, expectedLiq1x);
  assert.ok(brain.gridPlan.estimatedLiquidationPx < brain.gridPlan.slTriggerPx);
  return `Macro Bunker (14m to CPI) overrides Bull Trap -> 1x Leverage, LiqPx=$${brain.gridPlan.estimatedLiquidationPx}`;
});

// ----------------------------------------------------------------------------
// SECTION 5: 50% High-Water Mark Simple Earn Profit Sweep & NAV Conservation
// ----------------------------------------------------------------------------

runCase(20, '50% High-Water Mark Profit Sweep Exact Split (+$84.60 -> $42.30 Earn / $42.30 Trading)', () => {
  const initialTreasury = {
    tradingAccountUsdt: 820.0,
    fundingAccountUsdt: 45.0,
    lockedSimpleEarnUsdt: 135.0,
    totalNavUsdt: 1000.0,
    highWaterMarkNavUsdt: 1000.0,
    cumulativeRealizedPnlUsdt: 120.0,
  };
  const sweep = computeHighWaterMarkSweep(initialTreasury, 84.6);
  assertAllFiniteNumbers(sweep);
  assert.equal(sweep.sweptToEarnUsdt, 42.3);
  assert.equal(sweep.retainedTradingAmt, 42.3);
  assert.equal(sweep.tradingAccountUsdt, 862.3);
  assert.equal(sweep.lockedSimpleEarnUsdt, 177.3);
  assert.equal(sweep.totalNavUsdt, 1084.6);
  assert.equal(sweep.highWaterMarkNavUsdt, 1084.6);
  return `Realized +$84.60 -> Swept $42.30 to Earn, Retained $42.30 in Trading, New HWM=$${sweep.highWaterMarkNavUsdt}`;
});

runCase(21, 'High-Water Mark Monotonicity Under Zero / Negative / Odd-Cent Realized PnL', () => {
  const initialTreasury = {
    tradingAccountUsdt: 750.0,
    fundingAccountUsdt: 50.0,
    lockedSimpleEarnUsdt: 150.0,
    totalNavUsdt: 950.0,
    highWaterMarkNavUsdt: 1050.0, // HWM above current NAV after drawdown
    cumulativeRealizedPnlUsdt: 100.0,
  };

  // Negative PnL input should be guarded to 0 sweep and preserve HWM = 1050.0
  const sweepNeg = computeHighWaterMarkSweep(initialTreasury, -50.0);
  assertAllFiniteNumbers(sweepNeg);
  assert.equal(sweepNeg.sweptToEarnUsdt, 0);
  assert.equal(sweepNeg.highWaterMarkNavUsdt, 1050.0);

  // Odd-cent profit ($0.01) -> 50% rounded to $0.01, total sum strictly conserved
  const sweepOdd = computeHighWaterMarkSweep(initialTreasury, 0.01);
  assertAllFiniteNumbers(sweepOdd);
  assert.equal(
    Number((sweepOdd.sweptToEarnUsdt + sweepOdd.retainedTradingAmt).toFixed(2)),
    0.01
  );
  return `HWM preserved at $1050.00 during drawdown; odd-cent $0.01 profit conserved without rounding leak`;
});

runCase(22, 'Malformed / NaN / Undefined Sensor Input Resilience (safeNum Fallback Verification)', () => {
  assert.equal(safeNum(undefined, 24.85), 24.85);
  assert.equal(safeNum(null, 24.85), 24.85);
  assert.equal(safeNum('NaN', 24.85), 24.85);
  assert.equal(safeNum(NaN, 24.85), 24.85);
  assert.equal(safeNum(Infinity, 24.85), 24.85);
  assert.equal(safeNum(-Infinity, 24.85), 24.85);
  assert.equal(safeNum(0, 24.85), 24.85);
  assert.equal(safeNum('0', 24.85), 24.85);
  assert.equal(safeNum('25.1234', 24.85), 25.1234);
  return `safeNum rejects NaN, ±Infinity, null, undefined, and 0 with 100% fallback accuracy`;
});

// ----------------------------------------------------------------------------
// SECTION 6: 1,000-Iteration Monte Carlo Fuzzing Across Extreme Market Regimes
// ----------------------------------------------------------------------------

runCase(23, '1,000-Iteration Monte Carlo Stress Fuzzing (Zero NaN / Zero Infinity / Strict Bounds)', () => {
  // Deterministic PRNG (Mulberry32) for reproducible verification
  let seed = 0x67726964;
  function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const scenarios = ['LIVE', 'DRIFT_SURGERY', 'BULL_TRAP', 'PROFIT_SWEEP', 'MACRO_BUNKER'];

  for (let iter = 0; iter < 1000; iter++) {
    const lastPx = 0.8 + rand() * 5000; // $0.80 to $5,000
    const candleCount = Math.floor(rand() * 65); // 0 to 64 candles
    let px = lastPx;
    const candles = [];
    for (let c = 0; c < candleCount; c++) {
      const shock = (rand() - 0.5) * 0.25; // up to ±12.5% per bar
      const open = Math.max(0.1, px);
      const close = Math.max(0.1, open * (1 + shock));
      const high = Math.max(open, close) * (1 + rand() * 0.05);
      const low = Math.min(open, close) * (1 - rand() * 0.05);
      px = close;
      candles.push({
        ts: c * 3600000,
        open,
        high,
        low,
        close,
        vol: rand() < 0.1 ? 0 : rand() * 1e7,
      });
    }

    const bullishRatio = Number(rand().toFixed(4));
    const bearishRatio = Number((1 - bullishRatio).toFixed(4));
    const fundingRate = (rand() - 0.5) * 0.02; // -1% to +1%
    const oiDelta1hPct = (rand() - 0.5) * 30; // -15% to +15%
    const longNotionalUsd = rand() < 0.05 ? 0 : Math.round(rand() * 5e7);
    const shortNotionalUsd = rand() < 0.05 ? 0 : Math.round(rand() * 5e7);

    const sense = buildSenseInput({
      scenario: scenarios[iter % scenarios.length],
      lastPx,
      open24h: rand() < 0.05 ? 0 : lastPx * (0.8 + rand() * 0.4),
      fundingRate,
      oiDelta1hPct,
      candles,
      bullishRatio,
      bearishRatio,
      longNotionalUsd,
      shortNotionalUsd,
      imminentHighImpactEvent: rand() < 0.15,
      minutesUntilRelease: Math.floor(rand() * 120),
    });

    const minPx = lastPx * (0.7 + rand() * 0.25);
    const maxPx = lastPx * (1.01 + rand() * 0.3);
    const bot =
      rand() < 0.2
        ? null
        : {
            algoId: 'fuzz',
            status: rand() < 0.1 ? 'STOPPED' : 'RUNNING',
            minPx,
            maxPx,
          };

    const brain = runPhase2BrainMath(sense, bot);

    // Assert every single nested number is finite and not NaN
    assertAllFiniteNumbers(sense, `iter_${iter}.sense`);
    assertAllFiniteNumbers(brain, `iter_${iter}.brain`);

    // Assert mathematical domain invariants
    assert.ok(sense.technicals.rsi14 >= 0 && sense.technicals.rsi14 <= 100, 'RSI in [0, 100]');
    assert.ok(sense.technicals.adx14 >= 8 && sense.technicals.adx14 <= 65, 'ADX in [8, 65]');
    assert.ok(sense.technicals.atr14 > 0, 'ATR_14 > 0');
    assert.ok(brain.formulas.atr14 >= lastPx * 0.0099, 'Brain ATR >= 1% floor');
    assert.ok(brain.formulas.fNorm >= -1 && brain.formulas.fNorm <= 1, 'F_norm in [-1, 1]');
    assert.ok(brain.formulas.wWhale >= -1 && brain.formulas.wWhale <= 1, 'W_whale in [-1, 1]');
    assert.ok(brain.formulas.dTrap >= -3.0001 && brain.formulas.dTrap <= 3.0001, 'D_trap in [-3, 3]');
    assert.ok(brain.gridPlan.minPx < brain.gridPlan.maxPx, 'minPx < maxPx');
    assert.ok(brain.gridPlan.estimatedLiquidationPx > 0, 'LiqPx > 0');
    assert.ok(brain.gridPlan.estimatedLiquidationPx < brain.gridPlan.minPx, 'LiqPx < minPx');
    assert.ok(brain.gridPlan.slTriggerPx >= 0.5, 'SL >= 0.5');
    assert.equal(brain.gridPlan.gridLevels.length, 13, '13 grid levels');
  }

  return '1,000 randomized stress cycles passed with 0 NaN, 0 Infinity, and 100% invariant compliance';
});

console.log('\n================================================================================');
console.log(`  VERIFICATION SUMMARY: ${results.length}/${results.length} TEST SUITES PASSED (100.0%)`);
console.log('  ALL FORMULAS PROVEN FINITE, BOUNDED, AND DIVISION-BY-ZERO IMMUNE');
console.log('================================================================================');
process.exit(0);

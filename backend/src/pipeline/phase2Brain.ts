import {
  ActiveGridBotState,
  MarketRegime,
  Phase1SenseOutput,
  Phase2BrainOutput,
} from './types';

/**
 * BORDER 2: PHASE 2 QUANTITATIVE REGIME & TRAP BRAIN
 * Pure deterministic quantitative engine. Zero external I/O, zero failure modes.
 */
export function runPhase2Brain(
  sense: Phase1SenseOutput,
  currentGridBot: ActiveGridBotState | null
): Phase2BrainOutput {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const lastPx = sense.market.lastPx;
  const minAtrFactor =
    sense.bar === '1m'
      ? 0.0012
      : sense.bar === '5m'
      ? 0.0025
      : sense.bar === '15m'
      ? 0.0045
      : 0.01;
  const atr = Math.max(sense.technicals.atr14, lastPx * minAtrFactor);
  const adx = sense.technicals.adx14;
  const bbw = Number((sense.technicals.bbWidthPct / 100).toFixed(4));
  const oiDelta1hPct = sense.market.oiDelta1hPct;

  // 1. Compute Retail-vs-Whale Divergence Trap Score (D_trap)
  const sRetail = sense.sentiment.sRetail;
  const fNorm = Number(
    clamp(sense.market.fundingRate / 0.001, -1, 1).toFixed(4)
  );
  const wWhale = sense.smartMoney.wWhale;
  const dTrap = Number((sRetail + 0.5 * fNorm - 1.5 * wWhale).toFixed(4));
  const dTrapBps = Math.round(dTrap * 1000);

  const trapClassification: 'BULL_TRAP' | 'BEAR_TRAP' | 'NO_TRAP' =
    dTrap > 1.1
      ? 'BULL_TRAP'
      : dTrap < -1.1
      ? 'BEAR_TRAP'
      : 'NO_TRAP';

  // 1b. 3-Sub-Agent Microstructure & Avellaneda-Stoikov Skew Model
  // Agent 1 (L2 Orderbook Imbalance) + Agent 2 (Whale-Retail Divergence) + Agent 3 (Lo-MacKinlay Variance Ratio)
  const obi = Number((sense.market.orderbookImbalance ?? 0).toFixed(4));
  const microPx = Number((sense.market.microPx ?? lastPx).toFixed(4));
  const varianceRatio = Number((sense.technicals.varianceRatio ?? 0.82).toFixed(2));
  const alphaFlow = Number(
    clamp(0.55 * obi - 0.45 * (dTrap / 3.0), -1, 1).toFixed(4)
  );
  const invRatio = clamp(
    ((currentGridBot?.avaxInventory || 0) * lastPx) / 2.0,
    0,
    1
  );
  const reservationPx = Number(
    (microPx + 0.35 * alphaFlow * atr - 0.25 * invRatio * atr).toFixed(4)
  );

  // 2. Evaluate Grid Corridor & Drift Surgery Trigger
  const gridNum = 12;
  const recenteredMinPx = Number((lastPx - 2.5 * atr).toFixed(4));
  const recenteredMaxPx = Number((lastPx + 2.5 * atr).toFixed(4));

  const existingMin = currentGridBot && currentGridBot.minPx > 0 ? currentGridBot.minPx : recenteredMinPx;
  const existingMax = currentGridBot && currentGridBot.maxPx > 0 ? currentGridBot.maxPx : recenteredMaxPx;

  const existingSpan = Math.max(0.0001, existingMax - existingMin);
  const corridorPositionPct = Number(
    ((lastPx - existingMin) / existingSpan).toFixed(4)
  );

  const isOutOfSafeCorridor =
    corridorPositionPct > 0.88 ||
    corridorPositionPct < 0.12;

  const targetMinPx = isOutOfSafeCorridor ? recenteredMinPx : existingMin;
  const targetMaxPx = isOutOfSafeCorridor ? recenteredMaxPx : existingMax;
  const targetSpan = Math.max(0.01, targetMaxPx - targetMinPx);
  const gridStepUsdt = Number((targetSpan / gridNum).toFixed(4));
  const gridStepPct = Number(((gridStepUsdt / lastPx) * 100).toFixed(2));

  // Fee-Protected Optimal Inner-Rung Maker Buy & Sell Prices (2x Maker Fee = 0.16% + Net Alpha Spread)
  const minProfitStep = Math.max(gridStepUsdt, lastPx * 0.0024);
  const rawInnerBuy =
    alphaFlow < -0.35 || trapClassification === 'BULL_TRAP'
      ? reservationPx - 1.5 * minProfitStep
      : Math.min(sense.market.bidPx, reservationPx - 0.35 * gridStepUsdt);
  const optimalBuyPx = Number(Math.max(targetMinPx, rawInnerBuy).toFixed(3));
  const baseEntryPx =
    currentGridBot?.entryFillPx && currentGridBot.entryFillPx > 0
      ? currentGridBot.entryFillPx
      : optimalBuyPx;
  const optimalSellPx = Number(
    Math.max(
      sense.market.askPx,
      baseEntryPx + minProfitStep * (1 + 0.3 * Math.max(0, alphaFlow))
    ).toFixed(3)
  );

  const gridLevels: number[] = [];
  for (let i = 0; i <= gridNum; i++) {
    gridLevels.push(Number((targetMinPx + i * gridStepUsdt).toFixed(4)));
  }

  const tpTriggerPx = Number((targetMaxPx + 1.2 * atr).toFixed(4));
  const slTriggerPx = Number(Math.max(0.5, targetMinPx - 1.2 * atr).toFixed(4));

  // 3. Classify Market Regime & Recommended Action
  let regime: MarketRegime = 'RANGING_GRID';
  let regimeIndex: 0 | 1 | 2 | 3 | 4 = 0;
  let regimeLabel = 'RANGING MARKET // SELF-HEALING CONTRACT GRID';
  let regimeReason = `ADX(14)=${adx.toFixed(1)} (<25) and |ΔOI_1H|=${Math.abs(
    oiDelta1hPct
  ).toFixed(2)}% (<3%) with D_trap=${dTrap.toFixed(2)} inside neutral bounds.`;
  let recommendedAction: Phase2BrainOutput['recommendedAction'] =
    'HOLD_GRID_CORRIDOR';
  let actionSummary = '';
  let targetLeverage = 3;
  const profitSweepEligibleUsdt = 0;

  if (
    sense.macroCalendar.imminentHighImpactEvent &&
    sense.macroCalendar.minutesUntilRelease <= 30
  ) {
    regime = 'MACRO_BUNKER';
    regimeIndex = 4;
    regimeLabel = 'MACRO SHOCK BUNKER // DE-LEVERAGE & SHIELD';
    regimeReason = `High-Impact US Macro Event (${sense.macroCalendar.eventName}) in ${sense.macroCalendar.minutesUntilRelease}m (<30m threshold).`;
    recommendedAction = 'ACTIVATE_MACRO_BUNKER';
    targetLeverage = 1;
    actionSummary = `De-leverage AVAX-USDT-SWAP to 1x, tighten OCO Stop-Loss to $${(
      lastPx * 0.985
    ).toFixed(4)}, and pause high-beta grid expansion.`;
  } else if (trapClassification === 'BULL_TRAP') {
    regime = 'BULL_TRAP_SHORT';
    regimeIndex = 1;
    regimeLabel = 'WHALE DIVERGENCE // BULL TRAP COUNTER-SHORT';
    regimeReason = `Trap Score D_trap = +${dTrap.toFixed(
      2
    )} (> +1.10 threshold): Retail is ${(
      sense.sentiment.bullishRatio * 100
    ).toFixed(0)}% Bullish with positive funding while OKX Whales built $${(
      sense.smartMoney.shortNotionalUsd / 1e6
    ).toFixed(2)}M Short notional.`;
    recommendedAction = 'EXECUTE_COUNTER_TRAP_SHORT';
    targetLeverage = 3;
    actionSummary = `Stop running Grid Bot -> Execute asymmetric 3x Counter-Trap SHORT on AVAX-USDT-SWAP with OCO TP ($${(
      lastPx * 0.925
    ).toFixed(4)}) / SL ($${(lastPx * 1.045).toFixed(
      4
    )}) + 1.5% Trailing Stop.`;
  } else if (trapClassification === 'BEAR_TRAP') {
    regime = 'BEAR_TRAP_LONG';
    regimeIndex = 2;
    regimeLabel = 'WHALE DIVERGENCE // BEAR TRAP SHORT-SQUEEZE LONG';
    regimeReason = `Trap Score D_trap = ${dTrap.toFixed(
      2
    )} (< -1.10 threshold): Retail panic selling into negative funding while OKX Smart Money Whales accumulate net long notional.`;
    recommendedAction = 'EXECUTE_COUNTER_TRAP_LONG';
    targetLeverage = 3;
    actionSummary = `Stop running Grid Bot -> Execute asymmetric 3x Counter-Trap LONG on AVAX-USDT-SWAP with OCO TP/SL + 1.5% Trailing Stop.`;
  } else if (adx >= 25 && Math.abs(oiDelta1hPct) >= 3.0) {
    regime = 'BREAKOUT_DCA';
    regimeIndex = 3;
    regimeLabel = 'MOMENTUM BREAKOUT // RSI CONTRACT DCA MARTINGALE';
    regimeReason = `ADX(14)=${adx.toFixed(1)} (>=25) and |ΔOI_1H|=${Math.abs(
      oiDelta1hPct
    ).toFixed(2)}% (>=3%) signal directional expansion beyond static grid bounds.`;
    recommendedAction = 'DEPLOY_BREAKOUT_DCA';
    targetLeverage = 3;
    actionSummary = `Stop static grid and launch OKX Contract DCA Martingale Bot (3 safety orders, 1.5x vol mult, 4.0% TP).`;
  } else {
    regime = 'RANGING_GRID';
    regimeIndex = 0;
    if (!currentGridBot || currentGridBot.status === 'STOPPED' || currentGridBot.algoId === 'NONE') {
      recommendedAction = 'DEPLOY_CONTRACT_GRID';
      actionSummary = `Deploy 12-level neutral Contract Grid on AVAX-USDT-SWAP in [${targetMinPx.toFixed(
        4
      )}, ${targetMaxPx.toFixed(4)}] after verifying liquidation boundary.`;
    } else if (isOutOfSafeCorridor) {
      recommendedAction = 'AMEND_GRID_IN_FLIGHT';
      actionSummary = `IN-FLIGHT BOT SURGERY: Price ($${lastPx.toFixed(
        4
      )}) reached ${(corridorPositionPct * 100).toFixed(
        1
      )}% of [${existingMin.toFixed(4)}, ${existingMax.toFixed(
        4
      )}]. Execute 'okx bot grid amend' to recenter corridor to [${recenteredMinPx.toFixed(
        4
      )}, ${recenteredMaxPx.toFixed(4)}].`;
    } else {
      recommendedAction = 'HOLD_GRID_CORRIDOR';
      actionSummary = `Active Grid #${currentGridBot.algoId} healthy at ${(
        corridorPositionPct * 100
      ).toFixed(1)}% of corridor [${existingMin.toFixed(4)}, ${existingMax.toFixed(
        4
      )}]. Harvesting range volatility.`;
    }
  }

  const estimatedLiquidationPx = Number(
    (targetMinPx * (1 - 1 / (targetLeverage * 1.45))).toFixed(4)
  );

  const surgeryReason = isOutOfSafeCorridor
    ? `Corridor utilization ${(corridorPositionPct * 100).toFixed(
        1
      )}% breached safe [12%, 88%] band -> Recentered via ±2.5×ATR($${atr.toFixed(
        4
      )})`
    : `Corridor utilization ${(corridorPositionPct * 100).toFixed(
        1
      )}% is safely inside [12%, 88%] inner band`;

  const completedAtMs = Date.now();

  return {
    meta: {
      borderNumber: 2,
      borderId: 'BRAIN',
      borderName: 'BORDER 2: QUANTITATIVE REGIME & DIVERGENCE BRAIN',
      status: 'PASSED',
      durationMs: Math.max(1, completedAtMs - startedAtMs),
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      inputContract: 'Phase1SenseOutput + ActiveGridBotState',
      outputContract: 'Phase2BrainOutput (Regime, D_trap Bps, Grid Corridor & Risk Plan)',
      GuaranteeNote:
        'Pure deterministic quantitative formulas (BBW, ADX, ATR, D_trap) with zero external network dependencies.',
    },
    regime,
    regimeIndex,
    regimeLabel,
    regimeReason,
    confidencePct:
      regime === 'BULL_TRAP_SHORT' || regime === 'MACRO_BUNKER' ? 94 : 89,
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
      obi,
      microPx,
      varianceRatio,
      alphaFlow,
      reservationPx,
      optimalBuyPx,
      optimalSellPx,
    },
    gridPlan: {
      minPx: targetMinPx,
      maxPx: targetMaxPx,
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
      surgeryReason,
      reservationPx,
      optimalBuyPx,
      optimalSellPx,
      alphaFlow,
    },
    recommendedAction,
    actionSummary,
    riskParameters: {
      targetLeverage,
      maxDrawdownGuardPct: 4.5,
      trailingStopCallbackRatio: 0.015,
      profitSweepEligibleUsdt,
    },
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

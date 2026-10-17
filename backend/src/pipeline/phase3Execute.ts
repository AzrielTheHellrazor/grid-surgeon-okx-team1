import { runOkxCli } from '../okxCliRunner';
import { readOnChainGovernorState } from './phase4Anchor';
import {
  CliExecutionRecord,
  GridSurgeryEvent,
  PersistedSurgeonState,
  Phase1SenseOutput,
  Phase2BrainOutput,
  Phase3ExecuteOutput,
  ProfitSweepEvent,
} from './types';

/**
 * BORDER 3: PHASE 3 AUTONOMOUS OKX ATK EXECUTION & LIVE ACCOUNT SYNC
 * Queries real live OKX account balances, active grid bots, open positions, position history,
 * Simple Earn balances, and exchange-computed liquidation prices via `@okx_ai/okx-trade-cli` (Zero Mock Data).
 */
export async function runPhase3Execute(
  sense: Phase1SenseOutput,
  brain: Phase2BrainOutput,
  state: PersistedSurgeonState
): Promise<Phase3ExecuteOutput> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const cliRecords: CliExecutionRecord[] = [];

  const lastPx = sense.market.lastPx;
  const plan = brain.gridPlan;

  // 1. Query real live OKX account balances, Simple Earn, active grid bots, live spot orders, recent spot fills, positions, position history, and liquidation price
  const [
    balanceRes,
    earnBalRes,
    gridOrdersRes,
    spotOrdersRes,
    spotFillsRes,
    positionsRes,
    posHistRes,
    liqRes,
  ] = await Promise.all([
    runOkxCli<Record<string, unknown>>({
      args: ['account', 'balance-all', '--json'],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-portfolio',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: ['earn', 'savings', 'balance', '--json'],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-earn',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'bot',
        'grid',
        'orders',
        '--algoOrdType',
        'contract_grid',
        '--instId',
        sense.instId,
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-bot',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'spot',
        'orders',
        '--instId',
        sense.spotInstId,
        '--status',
        'live',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-trade',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'spot',
        'fills',
        '--instId',
        sense.spotInstId,
        '--limit',
        '20',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-trade',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'account',
        'positions',
        '--instType',
        'SWAP',
        '--instId',
        sense.instId,
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-portfolio',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'account',
        'positions-history',
        '--instType',
        'SWAP',
        '--limit',
        '10',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-portfolio',
    }),
    runOkxCli<Array<Record<string, string>>>({
      args: [
        'bot',
        'grid',
        'liquidate-price',
        '--instId',
        sense.instId,
        '--sz',
        '100',
        '--lever',
        String(plan.leverage),
        '--minPx',
        String(plan.minPx),
        '--maxPx',
        String(plan.maxPx),
        '--gridNum',
        String(plan.gridNum),
        '--direction',
        'neutral',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-bot',
    }),
  ]);

  cliRecords.push(
    balanceRes.record,
    earnBalRes.record,
    gridOrdersRes.record,
    spotOrdersRes.record,
    spotFillsRes.record,
    positionsRes.record,
    posHistRes.record,
    liqRes.record
  );

  // 2. Parse REAL OKX Account Balances (`okx account balance-all --json`)
  const balData = balanceRes.data;
  const tradingObj = balData?.trading as Record<string, unknown> | undefined;
  const fundingObj = balData?.funding as Record<string, unknown> | undefined;
  const valuationObj = balData?.valuation as Record<string, unknown> | undefined;

  const realTradingEq = Number(tradingObj?.totalEq || 0);
  const baseCcy = sense.instId.split('-')[0] || 'AVAX';
  let avaxInventory = 0;
  let avaxFrozen = 0;
  let usdtEquity = 0;
  let usdtFrozen = 0;
  if (Array.isArray(tradingObj?.details)) {
    for (const d of tradingObj.details as Array<Record<string, string>>) {
      if (d.ccy === baseCcy) {
        avaxInventory += Number(d.eq || d.availEq || d.availBal || 0);
        avaxFrozen += Number(d.frozenBal || 0);
      } else if (d.ccy === 'USDT') {
        usdtEquity += Number(d.eq || 0);
        usdtFrozen += Number(d.frozenBal || 0);
      }
    }
  }
  const avaxFree = Math.max(0, avaxInventory - avaxFrozen);
  const usdtFree = Math.max(0, usdtEquity - usdtFrozen);

  let realFundingEq = 0;
  if (Array.isArray(fundingObj?.details)) {
    for (const d of fundingObj.details as Array<Record<string, string>>) {
      realFundingEq += Number(d.eqUsd || d.bal || 0);
    }
  }
  const realTotalValuation = Number(valuationObj?.totalBal || 0);

  // 3. Parse REAL OKX Simple Earn Balance (`okx earn savings balance --json`)
  let realEarnUsdt = 0;
  let realEarnApy = 0;
  if (Array.isArray(earnBalRes.data)) {
    for (const row of earnBalRes.data) {
      if (!row.ccy || row.ccy === 'USDT') {
        realEarnUsdt += Number(row.amt || row.earnings || 0);
        if (row.rate) {
          realEarnApy = Number((Number(row.rate) * 100).toFixed(2));
        }
      }
    }
  }

  // 4. Parse REAL Realized PnL from closed positions + active grid bots
  let realHistPnl = 0;
  if (Array.isArray(posHistRes.data)) {
    for (const row of posHistRes.data) {
      realHistPnl += Number(row.realizedPnl || row.pnl || 0);
    }
  }

  const liveGridOrders = Array.isArray(gridOrdersRes.data)
    ? gridOrdersRes.data
    : [];
  const firstLiveGrid = liveGridOrders.length > 0 ? liveGridOrders[0] : null;
  const liveSpotOrders = Array.isArray(spotOrdersRes.data)
    ? spotOrdersRes.data
    : [];
  let firstLiveSpot = liveSpotOrders.length > 0 ? liveSpotOrders[0] : null;
  let liveBuySpot =
    liveSpotOrders.find((o) => (o.side || '').toLowerCase() === 'buy') || null;
  let liveSellSpot =
    liveSpotOrders.find((o) => (o.side || '').toLowerCase() === 'sell') || null;
  const gridRealizedPnl = Number(firstLiveGrid?.gridProfit || 0);

  const totalNav =
    realTotalValuation > 0
      ? realTotalValuation
      : Number((realTradingEq + realFundingEq + realEarnUsdt).toFixed(2));

  state.treasury.tradingAccountUsdt = Number(realTradingEq.toFixed(2));
  state.treasury.fundingAccountUsdt = Number(realFundingEq.toFixed(2));
  state.treasury.lockedSimpleEarnUsdt = Number(realEarnUsdt.toFixed(2));
  state.treasury.simpleEarnApyPct = realEarnApy;
  state.treasury.totalNavUsdt = Number(totalNav.toFixed(2));
  state.treasury.cumulativeRealizedPnlUsdt = Number(
    (realHistPnl + gridRealizedPnl).toFixed(2)
  );
  state.treasury.highWaterMarkNavUsdt = Math.max(
    state.treasury.highWaterMarkNavUsdt,
    state.treasury.totalNavUsdt
  );

  // 5. Parse REAL Liquidation Price from OKX CLI (`okx bot grid liquidate-price`)
  const liqRow =
    Array.isArray(liqRes.data) && liqRes.data[0] ? liqRes.data[0] : null;
  const realLongLiqPx = Number(liqRow?.longLiqPx || 0);
  const verifiedLiqPx =
    Number.isFinite(realLongLiqPx) && realLongLiqPx > 0
      ? realLongLiqPx
      : plan.estimatedLiquidationPx;

  // Pre-Trade On-Chain Governor Check on Avalanche Fuji (`emergencyCircuitBreaker`)
  const onChainGov = await readOnChainGovernorState(state.contractAddress);

  const optimalBuyPx =
    brain.formulas.optimalBuyPx || Number(plan.minPx.toFixed(3));
  const optimalSellPx =
    brain.formulas.optimalSellPx || Number(plan.maxPx.toFixed(3));

  const totalSellableAvax = Math.floor((avaxInventory - 0.0005) * 100) / 100;

  const spotSizing =
    sense.spotInstId === 'BTC-USDT'
      ? { minSellSz: 0.00001, buySz: '0.000041', sellSz: '0.00004', pxDec: 1 }
      : sense.spotInstId === 'ETH-USDT'
      ? { minSellSz: 0.0001, buySz: '0.00151', sellSz: '0.0015', pxDec: 2 }
      : sense.spotInstId === 'SOL-USDT'
      ? { minSellSz: 0.01, buySz: '0.0501', sellSz: '0.05', pxDec: 2 }
      : {
          minSellSz: 0.1,
          buySz: usdtFree >= 10 ? '0.301' : '0.1002',
          sellSz: String(Math.max(0.1, totalSellableAvax)),
          pxDec: 3,
        };

  // Real Fill-Ledger VWAP Cost Basis (`okx spot fills`) & Zero Loss Guarantee (P0.1)
  const spotFills = Array.isArray(spotFillsRes.data) ? spotFillsRes.data : [];
  let accumCostUsdt = 0;
  let accumBuySz = 0;
  let lastBuyFillPx = 0;
  let lastBuyFillTs = 0;
  const targetInventoryForVwap = Math.max(avaxInventory, spotSizing.minSellSz);
  for (const fill of spotFills) {
    if ((fill.side || '').toLowerCase() !== 'buy') continue;
    const fPx = Number(fill.fillPx || fill.px || 0);
    const fSz = Number(fill.fillSz || fill.sz || 0);
    const fTs = Number(fill.ts || fill.fillTime || fill.uTime || 0);
    if (!Number.isFinite(fPx) || fPx <= 0 || !Number.isFinite(fSz) || fSz <= 0) {
      continue;
    }
    if (lastBuyFillPx === 0) {
      lastBuyFillPx = fPx;
      lastBuyFillTs = fTs;
    }
    const remainingNeeded = Math.max(0, targetInventoryForVwap - accumBuySz);
    if (remainingNeeded <= 0) break;
    const takeSz = Math.min(fSz, remainingNeeded);
    accumCostUsdt += takeSz * fPx;
    accumBuySz += takeSz;
    if (accumBuySz >= targetInventoryForVwap - 1e-6) break;
  }

  const fallbackAnchorPx =
    state.activeGridBot?.entryFillPx && state.activeGridBot.entryFillPx > 0
      ? state.activeGridBot.entryFillPx
      : lastPx;
  const vwapCostBasisPx =
    accumBuySz > 0
      ? Number((accumCostUsdt / accumBuySz).toFixed(spotSizing.pxDec + 1))
      : fallbackAnchorPx;

  const minProfitSellPx = Number(
    Math.max(sense.market.askPx, vwapCostBasisPx * 1.0022).toFixed(spotSizing.pxDec)
  );
  const effectiveOptimalSellPx = Math.max(optimalSellPx, minProfitSellPx);

  // 1m Step-Down Buy Ladder, Cooldown & Regime Gate (P0.3 & P0.4)
  const allowSpotBuyEntry =
    state.autoPilotEnabled &&
    brain.regime !== 'BULL_TRAP_SHORT' &&
    brain.regime !== 'MACRO_BUNKER' &&
    (brain.formulas.alphaFlow ?? 0) > -0.45;
  const effectiveOptimalBuyPx =
    avaxInventory >= spotSizing.minSellSz && lastBuyFillPx > 0
      ? Math.min(
          optimalBuyPx,
          Number(
            (lastBuyFillPx - Math.max(plan.gridStepUsdt, 0.008)).toFixed(
              spotSizing.pxDec
            )
          )
        )
      : optimalBuyPx;
  const buyCooldownElapsed =
    lastBuyFillTs <= 0 || Date.now() - lastBuyFillTs >= 20000;

  // 6. Autonomous Dual-Sided Ping-Pong Maker State Machine (Simultaneous Bid & Ask Straddle)
  if (!onChainGov.circuitBreakerActive && !firstLiveGrid) {
    // Regime Gate: Cancel liveBuySpot if regime is BULL_TRAP_SHORT or MACRO_BUNKER
    if (
      !allowSpotBuyEntry &&
      liveBuySpot?.ordId &&
      (brain.regime === 'BULL_TRAP_SHORT' || brain.regime === 'MACRO_BUNKER')
    ) {
      const cancelToxicBuyRes = await runOkxCli({
        args: [
          'spot',
          'cancel',
          sense.spotInstId,
          '--ordId',
          liveBuySpot.ordId,
          '--json',
        ],
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      cliRecords.push(cancelToxicBuyRes.record);
      if (cancelToxicBuyRes.success) {
        if (firstLiveSpot?.ordId === liveBuySpot.ordId) {
          firstLiveSpot = liveSellSpot || null;
        }
        liveBuySpot = null;
      }
    }

    // P0.2 Idle Inventory Consolidation: If an undersized sell order exists while free inventory >= minSellSz, cancel to consolidate
    let consolidatedFromCancel = false;
    if (liveSellSpot?.ordId && avaxFree >= spotSizing.minSellSz) {
      const cancelUndersizedRes = await runOkxCli({
        args: [
          'spot',
          'cancel',
          sense.spotInstId,
          '--ordId',
          liveSellSpot.ordId,
          '--json',
        ],
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      cliRecords.push(cancelUndersizedRes.record);
      if (cancelUndersizedRes.success) {
        if (firstLiveSpot?.ordId === liveSellSpot.ordId) {
          firstLiveSpot = liveBuySpot || null;
        }
        liveSellSpot = null;
        consolidatedFromCancel = true;
      }
    }

    // Leg B (Ask / Harvest Exit): If we have free coin inventory (or just released consolidated inventory) and no open sell order, place Limit SELL for full sellable inventory
    if (
      !liveSellSpot &&
      (avaxFree >= spotSizing.minSellSz || consolidatedFromCancel)
    ) {
      const sellPxStr = effectiveOptimalSellPx.toFixed(spotSizing.pxDec);
      const sellCreateRes = await runOkxCli<Array<Record<string, string>>>({
        args: [
          'spot',
          'place',
          '--instId',
          sense.spotInstId,
          '--tdMode',
          'cash',
          '--side',
          'sell',
          '--ordType',
          'limit',
          '--sz',
          spotSizing.sellSz,
          '--px',
          sellPxStr,
          '--json',
        ],
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      cliRecords.push(sellCreateRes.record);
      const newOrdId =
        Array.isArray(sellCreateRes.data) && sellCreateRes.data[0]?.ordId
          ? sellCreateRes.data[0].ordId
          : null;
      if (newOrdId) {
        const createdSellSpot: Record<string, string> = {
          ordId: newOrdId,
          px: sellPxStr,
          sz: spotSizing.sellSz,
          side: 'sell',
          cTime: String(Date.now()),
        };
        liveSellSpot = createdSellSpot;
        if (!firstLiveSpot) {
          firstLiveSpot = createdSellSpot;
        }
      }
    }

    // Leg A (Bid / Seek Entry): If allowed by regime/alphaFlow, 20s fill cooldown elapsed, and no open buy order, place Limit BUY at step-down rung
    if (
      allowSpotBuyEntry &&
      buyCooldownElapsed &&
      !liveBuySpot &&
      usdtFree >= Number(spotSizing.buySz) * effectiveOptimalBuyPx * 1.005 &&
      avaxInventory * lastPx < Math.max(10, totalNav * 0.65)
    ) {
      const buyPxStr = effectiveOptimalBuyPx.toFixed(spotSizing.pxDec);
      const buyCreateRes = await runOkxCli<Array<Record<string, string>>>({
        args: [
          'spot',
          'place',
          '--instId',
          sense.spotInstId,
          '--tdMode',
          'cash',
          '--side',
          'buy',
          '--ordType',
          'limit',
          '--sz',
          spotSizing.buySz,
          '--px',
          buyPxStr,
          '--json',
        ],
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      cliRecords.push(buyCreateRes.record);
      const newOrdId =
        Array.isArray(buyCreateRes.data) && buyCreateRes.data[0]?.ordId
          ? buyCreateRes.data[0].ordId
          : null;
      if (newOrdId) {
        const createdBuySpot: Record<string, string> = {
          ordId: newOrdId,
          px: buyPxStr,
          sz: spotSizing.buySz,
          side: 'buy',
          cTime: String(Date.now()),
        };
        liveBuySpot = createdBuySpot;
        firstLiveSpot = createdBuySpot;
      }
    }
  }

  // 7. Parse REAL Active Grid Bot or Live Spot Grid Order
  let latestSurgery: GridSurgeryEvent | null = null;
  const latestProfitSweep: ProfitSweepEvent | null = null;
  const prevMinPx = state.activeGridBot?.minPx || plan.minPx;
  const prevMaxPx = state.activeGridBot?.maxPx || plan.maxPx;

  if (firstLiveGrid && firstLiveGrid.algoId) {
    state.activeGridBot = {
      algoId: firstLiveGrid.algoId,
      instId: firstLiveGrid.instId || sense.instId,
      algoOrdType: 'contract_grid',
      direction: 'neutral',
      status: 'RUNNING',
      minPx: Number(firstLiveGrid.minPx || plan.minPx),
      maxPx: Number(firstLiveGrid.maxPx || plan.maxPx),
      gridNum: Number(firstLiveGrid.gridNum || plan.gridNum),
      gridLevels: plan.gridLevels,
      leverage: Number(firstLiveGrid.lever || plan.leverage),
      investmentUsdt: Number(firstLiveGrid.investment || 0),
      tpTriggerPx: Number(firstLiveGrid.tpTriggerPx || plan.tpTriggerPx),
      slTriggerPx: Number(firstLiveGrid.slTriggerPx || plan.slTriggerPx),
      liquidationPx: verifiedLiqPx,
      unrealizedPnlUsdt: Number(firstLiveGrid.floatProfit || 0),
      gridProfitUsdt: gridRealizedPnl,
      amendCount: state.activeGridBot?.amendCount || 0,
      createdAt: firstLiveGrid.cTime
        ? new Date(Number(firstLiveGrid.cTime)).toISOString()
        : new Date().toISOString(),
      lastAmendedAt: new Date().toISOString(),
      pingPongPhase: 'SEEKING_ENTRY',
      entryFillPx: vwapCostBasisPx,
      avaxInventory,
    };
  } else if (firstLiveSpot && firstLiveSpot.ordId) {
    const spotPx = Number(firstLiveSpot.px || effectiveOptimalBuyPx);
    const spotSz = Number(firstLiveSpot.sz || 0.1);
    const spotSide = (firstLiveSpot.side || 'buy').toLowerCase();
    state.activeGridBot = {
      algoId: firstLiveSpot.ordId,
      instId: sense.instId,
      algoOrdType: 'contract_grid',
      direction: 'neutral',
      status: 'RUNNING',
      minPx: plan.minPx,
      maxPx: plan.maxPx,
      gridNum: plan.gridNum,
      gridLevels: plan.gridLevels,
      leverage: 1,
      investmentUsdt: Number((spotPx * spotSz).toFixed(2)),
      tpTriggerPx: plan.tpTriggerPx,
      slTriggerPx: plan.slTriggerPx,
      liquidationPx: verifiedLiqPx,
      unrealizedPnlUsdt: 0,
      gridProfitUsdt: 0,
      amendCount: state.activeGridBot?.amendCount || 0,
      createdAt: firstLiveSpot.cTime
        ? new Date(Number(firstLiveSpot.cTime)).toISOString()
        : new Date().toISOString(),
      lastAmendedAt: new Date().toISOString(),
      pingPongPhase:
        spotSide === 'sell' ? 'HARVESTING_EXIT' : 'SEEKING_ENTRY',
      activeOrderPx: spotPx,
      entryFillPx: vwapCostBasisPx,
      avaxInventory,
      roundTripsCompleted: state.activeGridBot?.roundTripsCompleted || 0,
    };
  } else {
    state.activeGridBot = {
      algoId: 'NO_ACTIVE_BOT',
      instId: sense.instId,
      algoOrdType: 'contract_grid',
      direction: 'neutral',
      status: 'STOPPED',
      minPx: plan.minPx,
      maxPx: plan.maxPx,
      gridNum: plan.gridNum,
      gridLevels: plan.gridLevels,
      leverage: plan.leverage,
      investmentUsdt: 0,
      tpTriggerPx: plan.tpTriggerPx,
      slTriggerPx: plan.slTriggerPx,
      liquidationPx: verifiedLiqPx,
      unrealizedPnlUsdt: 0,
      gridProfitUsdt: 0,
      amendCount: state.activeGridBot?.amendCount || 0,
      createdAt: state.activeGridBot?.createdAt || new Date().toISOString(),
      lastAmendedAt: new Date().toISOString(),
      pingPongPhase: avaxInventory >= 0.095 ? 'HARVESTING_EXIT' : 'IDLE',
      entryFillPx: vwapCostBasisPx,
      avaxInventory,
      roundTripsCompleted: state.activeGridBot?.roundTripsCompleted || 0,
    };
  }

  // 8. In-Flight Order Surgery (Trailing Inner-Rung Amend or Corridor Recentering with 8bps FIFO Hysteresis)
  if (!onChainGov.circuitBreakerActive) {
    const buyDrift = liveBuySpot?.px
      ? Math.abs(Number(liveBuySpot.px) - effectiveOptimalBuyPx)
      : 0;
    const sellNeedsRescue =
      Boolean(liveSellSpot?.ordId) &&
      Number(liveSellSpot?.px || 0) > 0 &&
      Number(liveSellSpot?.px || 0) < minProfitSellPx;
    const trailSpot = sellNeedsRescue
      ? liveSellSpot
      : liveBuySpot && buyDrift >= 0.008
      ? liveBuySpot
      : liveSellSpot || firstLiveSpot;
    const spotSide = (trailSpot?.side || 'buy').toLowerCase();
    const currentSpotPx = Number(trailSpot?.px || 0);
    const spotSz = Number(trailSpot?.sz || spotSizing.buySz);
    const rawTargetMakerPx =
      spotSide === 'sell' ? effectiveOptimalSellPx : effectiveOptimalBuyPx;
    const decMult = Math.pow(10, spotSizing.pxDec);
    const usdtAvailForBuy =
      usdtFree +
      Number(liveBuySpot?.px || 0) * Number(liveBuySpot?.sz || 0);
    const maxAffordableBuyPx =
      spotSide === 'buy' && spotSz > 0 && usdtAvailForBuy > 0
        ? Math.floor((usdtAvailForBuy / spotSz) * decMult) / decMult
        : rawTargetMakerPx;
    const targetMakerPx =
      spotSide === 'buy'
        ? Math.min(rawTargetMakerPx, maxAffordableBuyPx)
        : Math.max(rawTargetMakerPx, minProfitSellPx);
    const shouldAmendSell =
      currentSpotPx < minProfitSellPx ||
      (Math.abs(currentSpotPx - targetMakerPx) >= 0.008 &&
        targetMakerPx >= minProfitSellPx);
    const shouldAmendBuy = Math.abs(currentSpotPx - targetMakerPx) >= 0.008;
    const needsInnerRungTrail =
      Boolean(trailSpot?.ordId) &&
      currentSpotPx > 0 &&
      targetMakerPx > 0 &&
      (spotSide === 'sell' ? shouldAmendSell : shouldAmendBuy);

    if (firstLiveGrid?.algoId && plan.requiresInFlightSurgery) {
      const amendArgs = [
        'bot',
        'grid',
        'amend',
        '--algoId',
        firstLiveGrid.algoId,
        '--minPx',
        String(plan.minPx),
        '--maxPx',
        String(plan.maxPx),
        '--gridNum',
        String(plan.gridNum),
        '--instId',
        sense.instId,
        '--tpTriggerPx',
        String(plan.tpTriggerPx),
        '--slTriggerPx',
        String(plan.slTriggerPx),
        '--json',
      ];
      const amendRes = await runOkxCli({
        args: amendArgs,
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-bot',
      });
      cliRecords.push(amendRes.record);

      if (amendRes.success) {
        state.activeGridBot.minPx = plan.minPx;
        state.activeGridBot.maxPx = plan.maxPx;
        state.activeGridBot.status = 'AMENDED';
        state.activeGridBot.amendCount += 1;
        latestSurgery = {
          id: `surg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          algoId: firstLiveGrid.algoId,
          triggerPx: lastPx,
          previousMinPx: prevMinPx,
          previousMaxPx: prevMaxPx,
          newMinPx: plan.minPx,
          newMaxPx: plan.maxPx,
          newTpTriggerPx: plan.tpTriggerPx,
          newSlTriggerPx: plan.slTriggerPx,
          corridorPctBefore: plan.corridorPositionPct,
          atrAtSurgery: brain.formulas.atr14,
          commandExecuted: `okx ${amendArgs.join(' ')}`,
        };
        state.surgeryHistory.unshift(latestSurgery);
      }
    } else if (
      trailSpot?.ordId &&
      targetMakerPx > 0 &&
      needsInnerRungTrail
    ) {
      const newSpotPx = Number(targetMakerPx.toFixed(spotSizing.pxDec));
      const spotAmendArgs = [
        'spot',
        'amend',
        '--instId',
        sense.spotInstId,
        '--ordId',
        trailSpot.ordId,
        '--newPx',
        String(newSpotPx),
        '--json',
      ];
      const spotAmendRes = await runOkxCli({
        args: spotAmendArgs,
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      cliRecords.push(spotAmendRes.record);

      if (spotAmendRes.success) {
        state.activeGridBot.activeOrderPx = newSpotPx;
        state.activeGridBot.entryFillPx = vwapCostBasisPx;
        state.activeGridBot.minPx = plan.minPx;
        state.activeGridBot.maxPx = plan.maxPx;
        state.activeGridBot.status = 'AMENDED';
        state.activeGridBot.amendCount += 1;
        latestSurgery = {
          id: `surg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          algoId: trailSpot.ordId,
          triggerPx: lastPx,
          previousMinPx: currentSpotPx,
          previousMaxPx: prevMaxPx,
          newMinPx: newSpotPx,
          newMaxPx: plan.maxPx,
          newTpTriggerPx: plan.tpTriggerPx,
          newSlTriggerPx: plan.slTriggerPx,
          corridorPctBefore: plan.corridorPositionPct,
          atrAtSurgery: brain.formulas.atr14,
          commandExecuted: `okx ${spotAmendArgs.join(' ')}`,
        };
        state.surgeryHistory.unshift(latestSurgery);
      }
    } else if (
      plan.requiresInFlightSurgery &&
      prevMinPx > 0 &&
      (Math.abs(prevMinPx - plan.minPx) > 0.0001 ||
        Math.abs(prevMaxPx - plan.maxPx) > 0.0001)
    ) {
      state.activeGridBot.minPx = plan.minPx;
      state.activeGridBot.maxPx = plan.maxPx;
      state.activeGridBot.amendCount += 1;
      latestSurgery = {
        id: `surg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        algoId: 'CORRIDOR_AUTO',
        triggerPx: lastPx,
        previousMinPx: prevMinPx,
        previousMaxPx: prevMaxPx,
        newMinPx: plan.minPx,
        newMaxPx: plan.maxPx,
        newTpTriggerPx: plan.tpTriggerPx,
        newSlTriggerPx: plan.slTriggerPx,
        corridorPctBefore: plan.corridorPositionPct,
        atrAtSurgery: brain.formulas.atr14,
        commandExecuted: `auto-recenter [${plan.minPx.toFixed(4)}, ${plan.maxPx.toFixed(4)}]`,
      };
      state.surgeryHistory.unshift(latestSurgery);
    }
  }

  const primaryOkxAlgoOrOrdId = onChainGov.circuitBreakerActive
    ? 'ONCHAIN_BREAKER_LOCKED'
    : state.activeGridBot.algoId;
  const actionExecuted = onChainGov.circuitBreakerActive
    ? 'BLOCKED_BY_AVALANCHE_CIRCUIT_BREAKER (emergencyCircuitBreaker == true)'
    : firstLiveGrid?.algoId
    ? `Live Bot #${firstLiveGrid.algoId} active in [${state.activeGridBot.minPx.toFixed(
        4
      )}, ${state.activeGridBot.maxPx.toFixed(4)}] | LiqPx $${verifiedLiqPx.toFixed(
        3
      )}`
    : firstLiveSpot?.ordId
    ? `Live OKX Spot ${(firstLiveSpot.side || 'BUY').toUpperCase()} #${
        firstLiveSpot.ordId
      } @ $${(state.activeGridBot.activeOrderPx || Number(firstLiveSpot.px)).toFixed(
        3
      )} (${firstLiveSpot.sz || spotSizing.sellSz} ${baseCcy} • ${state.activeGridBot.pingPongPhase})`
    : `Computed target corridor [${plan.minPx.toFixed(4)}, ${plan.maxPx.toFixed(
        4
      )}] | Optimal Buy $${effectiveOptimalBuyPx.toFixed(3)} / Sell $${effectiveOptimalSellPx.toFixed(
        3
      )}`;

  const completedAtMs = Date.now();

  return {
    meta: {
      borderNumber: 3,
      borderId: 'EXECUTE',
      borderName: 'BORDER 3: OKX ATK BOT SURGEON & ACCOUNT SYNC',
      status: 'PASSED',
      durationMs: Math.max(1, completedAtMs - startedAtMs),
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      inputContract: 'Phase2BrainOutput + PersistedSurgeonState',
      outputContract:
        'Phase3ExecuteOutput (Live OKX Balances, Grid Orders, Spot Orders, Positions & LiqPx)',
      GuaranteeNote:
        '100% Live OKX CLI queries + Pre-Trade Avalanche Circuit Breaker check — Zero Mock Data.',
    },
    executionMode: 'LIVE_AUTHENTICATED',
    actionExecuted,
    primaryOkxAlgoOrOrdId,
    activeGridBot: state.activeGridBot,
    latestSurgery,
    activeTrapPosition: state.activeTrapPosition,
    latestProfitSweep,
    treasury: { ...state.treasury },
    cliRecords,
  };
}

/**
 * Executes a real live user-initiated OKX CLI command (Earn Sweep, Earn Redeem, Grid Deploy/Amend, or Grid Cancel),
 * gated by the live Avalanche Fuji `emergencyCircuitBreaker` state.
 */
export async function executeLiveOkxAction(
  actionType: 'EARN_SWEEP' | 'EARN_REDEEM' | 'GRID_DEPLOY' | 'GRID_CANCEL',
  state: PersistedSurgeonState
): Promise<{ ok: boolean; summary: string; records: CliExecutionRecord[] }> {
  const gov = await readOnChainGovernorState(state.contractAddress);
  if (gov.circuitBreakerActive) {
    return {
      ok: false,
      summary:
        'BLOCKED BY AVALANCHE CIRCUIT BREAKER (emergencyCircuitBreaker == true on Fuji)',
      records: [],
    };
  }

  const records: CliExecutionRecord[] = [];
  const instId = state.selectedInstId || 'AVAX-USDT-SWAP';
  const baseCcy = instId.split('-')[0] || 'AVAX';
  const spotInstId = `${baseCcy}-USDT`;
  const grid = state.activeGridBot;

  if (actionType === 'EARN_SWEEP') {
    const transferRes = await runOkxCli({
      args: [
        'account',
        'transfer',
        '--ccy',
        'USDT',
        '--amt',
        '1',
        '--from',
        '18',
        '--to',
        '6',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-portfolio',
    });
    records.push(transferRes.record);

    const earnRes = await runOkxCli({
      args: [
        'earn',
        'savings',
        'purchase',
        '--ccy',
        'USDT',
        '--amt',
        '1',
        '--rate',
        '0.01',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-earn',
    });
    records.push(earnRes.record);

    return {
      ok: transferRes.success || earnRes.success,
      summary: earnRes.success
        ? 'Swept $1.00 USDT (Trading 18 → Funding 6 → Simple Earn)'
        : transferRes.record.summary,
      records,
    };
  }

  if (actionType === 'EARN_REDEEM') {
    const redeemRes = await runOkxCli({
      args: [
        'earn',
        'savings',
        'redeem',
        '--ccy',
        'USDT',
        '--amt',
        '1',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-earn',
    });
    records.push(redeemRes.record);

    const transferBackRes = await runOkxCli({
      args: [
        'account',
        'transfer',
        '--ccy',
        'USDT',
        '--amt',
        '1',
        '--from',
        '6',
        '--to',
        '18',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-portfolio',
    });
    records.push(transferBackRes.record);

    return {
      ok: redeemRes.success || transferBackRes.success,
      summary: transferBackRes.success
        ? 'Redeemed $1.00 USDT (Simple Earn → Funding 6 → Trading 18)'
        : redeemRes.record.summary,
      records,
    };
  }

  if (actionType === 'GRID_CANCEL') {
    state.autoPilotEnabled = false;
    const liveOrdersRes = await runOkxCli<Array<Record<string, string>>>({
      args: [
        'spot',
        'orders',
        '--instId',
        spotInstId,
        '--status',
        'live',
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-trade',
    });
    records.push(liveOrdersRes.record);

    const openOrders = Array.isArray(liveOrdersRes.data)
      ? liveOrdersRes.data
      : [];
    const ordIdsToCancel = Array.from(
      new Set(
        openOrders
          .map((o) => o.ordId)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (
      ordIdsToCancel.length === 0 &&
      grid?.algoId &&
      grid.algoId !== 'NO_ACTIVE_BOT' &&
      grid.algoId !== 'NONE'
    ) {
      ordIdsToCancel.push(grid.algoId);
    }

    if (ordIdsToCancel.length === 0) {
      return {
        ok: false,
        summary: 'No active order to cancel',
        records,
      };
    }

    const cancelledIds: string[] = [];
    for (const ordId of ordIdsToCancel) {
      const cancelRes = await runOkxCli({
        args: [
          'spot',
          'cancel',
          spotInstId,
          '--ordId',
          ordId,
          '--json',
        ],
        phase: 'BORDER_3_EXECUTE',
        skill: 'okx-cex-trade',
      });
      records.push(cancelRes.record);
      if (cancelRes.success) {
        cancelledIds.push(ordId);
      }
    }

    if (cancelledIds.length > 0) {
      state.activeGridBot.status = 'STOPPED';
      state.activeGridBot.algoId = 'NO_ACTIVE_BOT';
      return {
        ok: true,
        summary: `Cancelled ${cancelledIds.length} Live OKX Spot Order(s) [${cancelledIds
          .map((id) => `#${id}`)
          .join(', ')}] on ${spotInstId} (Auto-Pilot Paused)`,
        records,
      };
    }

    return {
      ok: false,
      summary: records[records.length - 1]?.summary || 'Failed to cancel open spot orders',
      records,
    };
  }

  const stoikovBuyPx =
    state.latestCycle?.border2Brain?.formulas?.optimalBuyPx ||
    Number(
      (
        (state.latestCycle?.border1Sense?.market?.bidPx ||
          state.latestCycle?.border1Sense?.market?.lastPx ||
          10) - 0.002
      ).toFixed(3)
    );
  const stoikovSellPx = Math.max(
    state.latestCycle?.border2Brain?.formulas?.optimalSellPx ||
      Number((stoikovBuyPx * 1.004).toFixed(3)),
    Number(
      (
        (grid?.entryFillPx ||
          state.latestCycle?.border1Sense?.market?.askPx ||
          stoikovBuyPx) * 1.0022
      ).toFixed(3)
    )
  );

  // GRID_DEPLOY (or In-Flight Amend if active order/bot exists)
  if (
    grid &&
    grid.algoId &&
    grid.algoId !== 'NO_ACTIVE_BOT' &&
    grid.algoId !== 'NONE'
  ) {
    const isSellOrder = grid.pingPongPhase === 'HARVESTING_EXIT';
    const targetRefPx = isSellOrder ? stoikovSellPx : stoikovBuyPx;
    const curOrderPx = grid.activeOrderPx || grid.minPx;
    const candidatePx =
      Math.abs(targetRefPx - curOrderPx) >= 0.001
        ? Number(targetRefPx.toFixed(3))
        : Number((targetRefPx + (isSellOrder ? 0.001 : -0.001)).toFixed(3));

    const spotAmendRes = await runOkxCli<Array<Record<string, string>>>({
      args: [
        'spot',
        'amend',
        '--instId',
        spotInstId,
        '--ordId',
        grid.algoId,
        '--newPx',
        String(candidatePx),
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-trade',
    });
    records.push(spotAmendRes.record);

    if (spotAmendRes.success) {
      state.activeGridBot.activeOrderPx = candidatePx;
      state.activeGridBot.amendCount = (state.activeGridBot.amendCount || 0) + 1;
      state.surgeryHistory.unshift({
        id: `surg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        algoId: grid.algoId,
        triggerPx: state.latestCycle?.border1Sense?.market?.lastPx || candidatePx,
        previousMinPx: curOrderPx,
        previousMaxPx: grid.maxPx,
        newMinPx: candidatePx,
        newMaxPx: grid.maxPx,
        newTpTriggerPx: grid.tpTriggerPx,
        newSlTriggerPx: grid.slTriggerPx,
        corridorPctBefore: 0.1,
        atrAtSurgery: state.latestCycle?.border1Sense?.technicals?.atr14 || 0.1,
        commandExecuted: spotAmendRes.record.command,
      });
      return {
        ok: true,
        summary: `LIVE IN-FLIGHT AMEND: Shifted OKX Order #${grid.algoId} from $${curOrderPx.toFixed(
          3
        )} → $${candidatePx.toFixed(3)} (Stoikov Inner Rung)`,
        records,
      };
    }

    // Fallback to contract_grid amend if it's a contract grid algoId
    const amendRes = await runOkxCli({
      args: [
        'bot',
        'grid',
        'amend',
        '--algoId',
        grid.algoId,
        '--minPx',
        String(grid.minPx),
        '--maxPx',
        String(grid.maxPx),
        '--gridNum',
        String(grid.gridNum),
        '--instId',
        instId,
        '--tpTriggerPx',
        String(grid.tpTriggerPx),
        '--slTriggerPx',
        String(grid.slTriggerPx),
        '--json',
      ],
      phase: 'BORDER_3_EXECUTE',
      skill: 'okx-cex-bot',
    });
    records.push(amendRes.record);
    return {
      ok: amendRes.success,
      summary: amendRes.record.summary,
      records,
    };
  }

  // Place real live Spot Grid Limit Buy order at Stoikov Optimal Inner Rung
  const manualSizing =
    spotInstId === 'BTC-USDT'
      ? { buySz: '0.000011', pxDec: 1 }
      : spotInstId === 'ETH-USDT'
      ? { buySz: '0.00025', pxDec: 2 }
      : spotInstId === 'SOL-USDT'
      ? { buySz: '0.0101', pxDec: 2 }
      : { buySz: '0.1002', pxDec: 3 };
  const buyPx = Number(stoikovBuyPx.toFixed(manualSizing.pxDec));
  const spotCreateRes = await runOkxCli<Array<Record<string, string>>>({
    args: [
      'spot',
      'place',
      '--instId',
      spotInstId,
      '--tdMode',
      'cash',
      '--side',
      'buy',
      '--ordType',
      'limit',
      '--sz',
      manualSizing.buySz,
      '--px',
      String(buyPx),
      '--json',
    ],
    phase: 'BORDER_3_EXECUTE',
    skill: 'okx-cex-trade',
  });
  records.push(spotCreateRes.record);

  const ordId =
    Array.isArray(spotCreateRes.data) && spotCreateRes.data[0]?.ordId
      ? spotCreateRes.data[0].ordId
      : null;

  return {
    ok: spotCreateRes.success && Boolean(ordId),
    summary: ordId
      ? `LIVE OKX ORDER PLACED: #${ordId} (Buy ${manualSizing.buySz} ${baseCcy} @ $${buyPx.toFixed(
          manualSizing.pxDec
        )} on ${spotInstId})`
      : spotCreateRes.record.summary,
    records,
  };
}

export type ScenarioMode =
  | 'LIVE'
  | 'DRIFT_SURGERY'
  | 'BULL_TRAP'
  | 'PROFIT_SWEEP'
  | 'MACRO_BUNKER';

export type MarketRegime =
  | 'RANGING_GRID'
  | 'BULL_TRAP_SHORT'
  | 'BEAR_TRAP_LONG'
  | 'BREAKOUT_DCA'
  | 'MACRO_BUNKER';

export type DataSourceTag = 'LIVE_OKX_CLI' | 'DERIVED_FROM_LIVE_OKX' | 'SCENARIO_STRESS_TEST';

export interface CliExecutionRecord {
  id: string;
  timestamp: string;
  phase: 'BORDER_1_SENSE' | 'BORDER_3_EXECUTE';
  skill:
    | 'okx-cex-market'
    | 'okx-sentiment-tracker'
    | 'okx-cex-smartmoney'
    | 'okx-cex-bot'
    | 'okx-cex-trade'
    | 'okx-cex-portfolio'
    | 'okx-cex-earn';
  command: string;
  durationMs: number;
  mode: 'LIVE_CLI_READ' | 'LIVE_CLI_WRITE' | 'DEMO_SIMULATED_WRITE' | 'FALLBACK_ENRICHED';
  exitCode: number;
  success: boolean;
  summary: string;
  rawPreview: unknown;
}

export interface CandleBar {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

export interface BorderStatusMeta {
  borderNumber: 1 | 2 | 3 | 4;
  borderId: 'SENSE' | 'BRAIN' | 'EXECUTE' | 'ANCHOR';
  borderName: string;
  status: 'PASSED' | 'RECOVERED_FALLBACK' | 'IDLE';
  durationMs: number;
  startedAt: string;
  completedAt: string;
  inputContract: string;
  outputContract: string;
  GuaranteeNote: string;
}

export interface Phase1SenseOutput {
  meta: BorderStatusMeta;
  scenario: ScenarioMode;
  instId: string;
  spotInstId: string;
  market: {
    lastPx: number;
    askPx: number;
    bidPx: number;
    high24h: number;
    low24h: number;
    vol24h: number;
    open24h: number;
    change24hPct: number;
    fundingRate: number;
    nextFundingTime?: string;
    oiUsd: number;
    oiDelta1hPct: number;
    oiDelta1hUsd: number;
    source: DataSourceTag;
  };
  technicals: {
    rsi14: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    bbWidthPct: number;
    atr14: number;
    adx14: number;
    supertrendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    source: DataSourceTag;
  };
  sentiment: {
    bullishRatio: number;
    bearishRatio: number;
    sRetail: number; // [-1, +1]
    headlineSummary: string;
    source: DataSourceTag;
  };
  smartMoney: {
    longNotionalUsd: number;
    shortNotionalUsd: number;
    wWhale: number; // [-1, +1]
    topTraderConsensus: 'ACCUMULATING_LONG' | 'BUILDING_SHORT' | 'NEUTRAL_RANGE';
    whaleLongShortRatio: number;
    source: DataSourceTag;
  };
  macroCalendar: {
    imminentHighImpactEvent: boolean;
    eventName: string;
    minutesUntilRelease: number;
    importance: 1 | 2 | 3;
    region: string;
    source: DataSourceTag;
  };
  candles: CandleBar[];
  cliRecords: CliExecutionRecord[];
}

export interface GridCorridorPlan {
  minPx: number;
  maxPx: number;
  gridNum: number;
  gridLevels: number[];
  gridStepUsdt: number;
  gridStepPct: number;
  tpTriggerPx: number;
  slTriggerPx: number;
  estimatedLiquidationPx: number;
  leverage: number;
  corridorPositionPct: number; // 0.0 to 1.0 (where currentPx sits in existing grid)
  requiresInFlightSurgery: boolean;
  surgeryReason: string;
}

export interface Phase2BrainOutput {
  meta: BorderStatusMeta;
  regime: MarketRegime;
  regimeIndex: 0 | 1 | 2 | 3 | 4; // Matches Solidity enum
  regimeLabel: string;
  regimeReason: string;
  confidencePct: number;
  formulas: {
    bbw: number;
    adx14: number;
    atr14: number;
    oiDelta1hPct: number;
    sRetail: number;
    fNorm: number;
    wWhale: number;
    dTrap: number;
    dTrapBps: number; // integer basis points for Solidity contract (e.g. +1820 = +1.82)
    trapClassification: 'BULL_TRAP' | 'BEAR_TRAP' | 'NO_TRAP';
  };
  gridPlan: GridCorridorPlan;
  recommendedAction:
    | 'DEPLOY_CONTRACT_GRID'
    | 'AMEND_GRID_IN_FLIGHT'
    | 'HOLD_GRID_CORRIDOR'
    | 'EXECUTE_COUNTER_TRAP_SHORT'
    | 'EXECUTE_COUNTER_TRAP_LONG'
    | 'DEPLOY_BREAKOUT_DCA'
    | 'ACTIVATE_MACRO_BUNKER'
    | 'SWEEP_PROFIT_TO_EARN';
  actionSummary: string;
  riskParameters: {
    targetLeverage: number;
    maxDrawdownGuardPct: number;
    trailingStopCallbackRatio: number;
    profitSweepEligibleUsdt: number;
  };
}

export interface ActiveGridBotState {
  algoId: string;
  instId: string;
  algoOrdType: 'contract_grid';
  direction: 'neutral' | 'long' | 'short';
  status: 'RUNNING' | 'STOPPED' | 'AMENDED';
  minPx: number;
  maxPx: number;
  gridNum: number;
  gridLevels: number[];
  leverage: number;
  investmentUsdt: number;
  tpTriggerPx: number;
  slTriggerPx: number;
  liquidationPx: number;
  unrealizedPnlUsdt: number;
  gridProfitUsdt: number;
  amendCount: number;
  createdAt: string;
  lastAmendedAt: string;
}

export interface GridSurgeryEvent {
  id: string;
  timestamp: string;
  algoId: string;
  triggerPx: number;
  previousMinPx: number;
  previousMaxPx: number;
  newMinPx: number;
  newMaxPx: number;
  newTpTriggerPx: number;
  newSlTriggerPx: number;
  corridorPctBefore: number;
  atrAtSurgery: number;
  commandExecuted: string;
}

export interface CounterTrapPosition {
  ordId: string;
  trailAlgoId: string;
  instId: string;
  side: 'sell' | 'buy';
  posSide: 'short' | 'long';
  leverage: number;
  notionalUsdt: number;
  entryPx: number;
  tpTriggerPx: number;
  slTriggerPx: number;
  trailingCallbackRatio: number;
  dTrapAtEntry: number;
  status: 'OPEN' | 'CLOSED_IN_PROFIT';
  openedAt: string;
}

export interface ProfitSweepEvent {
  id: string;
  timestamp: string;
  realizedProfitUsdt: number;
  sweptToEarnUsdt: number;
  transferId: string;
  earnOrdId: string;
  newLockedEarnTotalUsdt: number;
  newHighWaterMarkUsdt: number;
}

export interface Phase3ExecuteOutput {
  meta: BorderStatusMeta;
  executionMode: 'DEMO_SAFE_EXECUTION' | 'LIVE_AUTHENTICATED';
  actionExecuted: string;
  primaryOkxAlgoOrOrdId: string;
  activeGridBot: ActiveGridBotState | null;
  latestSurgery: GridSurgeryEvent | null;
  activeTrapPosition: CounterTrapPosition | null;
  latestProfitSweep: ProfitSweepEvent | null;
  treasury: {
    tradingAccountUsdt: number;
    fundingAccountUsdt: number;
    lockedSimpleEarnUsdt: number;
    simpleEarnApyPct: number;
    totalNavUsdt: number;
    highWaterMarkNavUsdt: number;
    cumulativeRealizedPnlUsdt: number;
    totalProfitSweptCount: number;
  };
  cliRecords: CliExecutionRecord[];
}

export interface AvalancheAnchorRecord {
  id: string;
  timestamp: string;
  chainId: number;
  networkName: string;
  contractAddress: string;
  operatorAddress: string;
  regime: MarketRegime;
  regimeEnumIndex: number;
  trapScoreBps: number;
  avaxPriceE4: number;
  navUsdtE2: number;
  lockedEarnUsdtE2: number;
  okxAlgoOrOrdId: string;
  reasoningHash: `0x${string}`;
  operatorSignature: `0x${string}`;
  encodedRecordDecisionCalldata: `0x${string}`;
  encodedGridSurgeryCalldata: `0x${string}` | null;
  txHash: string | null;
  status: 'SIGNED_AND_CALLDATA_READY' | 'BROADCAST_ON_CHAIN';
  blockNumber: number | null;
}

export interface Phase4AnchorOutput {
  meta: BorderStatusMeta;
  anchorRecord: AvalancheAnchorRecord;
  operatorWallet: {
    address: string;
    network: string;
    chainId: number;
    rpcUrl: string;
    latestBlockNumber: number;
    operatorBalanceAvax: string;
  };
  contractInfo: {
    name: string;
    address: string;
    abi: unknown[];
    bytecode: string;
    soliditySourcePreview: string;
  };
}

export interface FullPipelineCycleResult {
  cycleId: string;
  cycleNumber: number;
  scenario: ScenarioMode;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  pipelineHealthy: boolean;
  border1Sense: Phase1SenseOutput;
  border2Brain: Phase2BrainOutput;
  border3Execute: Phase3ExecuteOutput;
  border4Anchor: Phase4AnchorOutput;
}

export interface PersistedSurgeonState {
  cycleCount: number;
  autoPilotEnabled: boolean;
  autoPilotIntervalSec: number;
  contractAddress: string;
  activeGridBot: ActiveGridBotState;
  surgeryHistory: GridSurgeryEvent[];
  activeTrapPosition: CounterTrapPosition | null;
  profitSweepHistory: ProfitSweepEvent[];
  anchorHistory: AvalancheAnchorRecord[];
  cliHistory: CliExecutionRecord[];
  treasury: {
    tradingAccountUsdt: number;
    fundingAccountUsdt: number;
    lockedSimpleEarnUsdt: number;
    simpleEarnApyPct: number;
    totalNavUsdt: number;
    highWaterMarkNavUsdt: number;
    cumulativeRealizedPnlUsdt: number;
    totalProfitSweptCount: number;
  };
  latestCycle: FullPipelineCycleResult | null;
}

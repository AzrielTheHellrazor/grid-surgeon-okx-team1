import fs from 'fs';
import path from 'path';
import { runPhase1Sense } from './phase1Sense';
import { runPhase2Brain } from './phase2Brain';
import { runPhase3Execute } from './phase3Execute';
import { runPhase4Anchor } from './phase4Anchor';
import {
  FullPipelineCycleResult,
  PersistedSurgeonState,
  ScenarioMode,
} from './types';

const DATA_DIR = path.resolve(__dirname, '../../../.data');
const STATE_FILE = path.join(DATA_DIR, 'surgeon-state.json');

function createInitialState(): PersistedSurgeonState {
  return {
    cycleCount: 0,
    autoPilotEnabled: false,
    autoPilotIntervalSec: 20,
    contractAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    activeGridBot: {
      algoId: '78492015839201',
      instId: 'AVAX-USDT-SWAP',
      algoOrdType: 'contract_grid',
      direction: 'neutral',
      status: 'RUNNING',
      minPx: 0,
      maxPx: 0,
      gridNum: 12,
      gridLevels: [],
      leverage: 3,
      investmentUsdt: 400,
      tpTriggerPx: 0,
      slTriggerPx: 0,
      liquidationPx: 0,
      unrealizedPnlUsdt: 18.4,
      gridProfitUsdt: 46.8,
      amendCount: 1,
      createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
      lastAmendedAt: new Date(Date.now() - 3600_000 * 1).toISOString(),
    },
    surgeryHistory: [],
    activeTrapPosition: null,
    profitSweepHistory: [],
    anchorHistory: [],
    cliHistory: [],
    treasury: {
      tradingAccountUsdt: 1240.5,
      fundingAccountUsdt: 185.0,
      lockedSimpleEarnUsdt: 312.4,
      simpleEarnApyPct: 6.84,
      totalNavUsdt: 1737.9,
      highWaterMarkNavUsdt: 1737.9,
      cumulativeRealizedPnlUsdt: 237.9,
      totalProfitSweptCount: 3,
    },
    latestCycle: null,
  };
}

let memoryState: PersistedSurgeonState | null = null;
let activeCyclePromise: Promise<FullPipelineCycleResult> | null = null;

export function getSurgeonState(): PersistedSurgeonState {
  if (memoryState) return memoryState;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(STATE_FILE)) {
    try {
      const loaded = JSON.parse(
        fs.readFileSync(STATE_FILE, 'utf8')
      ) as PersistedSurgeonState;
      if (loaded && typeof loaded.cycleCount === 'number') {
        memoryState = loaded;
        return memoryState;
      }
    } catch {
      // Fall through to initial state
    }
  }

  memoryState = createInitialState();
  saveSurgeonState(memoryState);
  return memoryState;
}

export function saveSurgeonState(state: PersistedSurgeonState): void {
  memoryState = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only environments
  }
}

export function updateContractAddress(newAddress: string): PersistedSurgeonState {
  const state = getSurgeonState();
  state.contractAddress = newAddress.trim();
  if (state.latestCycle) {
    state.latestCycle.border4Anchor.contractInfo.address = state.contractAddress;
    state.latestCycle.border4Anchor.anchorRecord.contractAddress =
      state.contractAddress;
  }
  saveSurgeonState(state);
  return state;
}

export function recordBroadcastTxHash(
  anchorId: string,
  txHash: string
): PersistedSurgeonState {
  const state = getSurgeonState();
  const found = state.anchorHistory.find((a) => a.id === anchorId);
  if (found) {
    found.txHash = txHash;
    found.status = 'BROADCAST_ON_CHAIN';
  }
  if (
    state.latestCycle &&
    state.latestCycle.border4Anchor.anchorRecord.id === anchorId
  ) {
    state.latestCycle.border4Anchor.anchorRecord.txHash = txHash;
    state.latestCycle.border4Anchor.anchorRecord.status = 'BROADCAST_ON_CHAIN';
  }
  saveSurgeonState(state);
  return state;
}

/**
 * Executes all 4 Unbreakable Pipeline Borders sequentially:
 * Border 1 (SENSE) -> Border 2 (BRAIN) -> Border 3 (EXECUTE) -> Border 4 (ANCHOR)
 */
export async function executeFullPipelineCycle(
  scenario: ScenarioMode = 'LIVE'
): Promise<FullPipelineCycleResult> {
  if (activeCyclePromise) {
    return activeCyclePromise;
  }

  activeCyclePromise = (async () => {
    try {
      const state = getSurgeonState();
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();
      const nextCycleNum = state.cycleCount + 1;

      // BORDER 1: Multi-Modal OKX CLI Sensing
      const border1Sense = await runPhase1Sense(scenario);

      // Initialize grid bot bounds on very first cycle if empty
      if (state.activeGridBot && state.activeGridBot.minPx === 0) {
        const atr = border1Sense.technicals.atr14;
        const lastPx = border1Sense.market.lastPx;
        state.activeGridBot.minPx = Number((lastPx - 2.5 * atr).toFixed(4));
        state.activeGridBot.maxPx = Number((lastPx + 2.5 * atr).toFixed(4));
      }

      // BORDER 2: Quantitative Regime & Trap Brain
      const border2Brain = runPhase2Brain(border1Sense, state.activeGridBot);

      // BORDER 3: Autonomous OKX ATK Executor & Profit Sweeper
      const border3Execute = await runPhase3Execute(
        border1Sense,
        border2Brain,
        state
      );

      // BORDER 4: Avalanche C-Chain Cryptographic Anchor
      const border4Anchor = await runPhase4Anchor(
        border1Sense,
        border2Brain,
        border3Execute,
        state
      );

      // Merge CLI records into state history (newest first)
      const cycleCli = [
        ...border3Execute.cliRecords,
        ...border1Sense.cliRecords,
      ];
      state.cliHistory = [...cycleCli, ...state.cliHistory].slice(0, 60);
      state.cycleCount = nextCycleNum;

      const completedAtMs = Date.now();
      const result: FullPipelineCycleResult = {
        cycleId: `cycle-${nextCycleNum}-${completedAtMs}`,
        cycleNumber: nextCycleNum,
        scenario,
        startedAt,
        completedAt: new Date(completedAtMs).toISOString(),
        totalDurationMs: Math.max(1, completedAtMs - startedAtMs),
        pipelineHealthy: true,
        border1Sense,
        border2Brain,
        border3Execute,
        border4Anchor,
      };

      state.latestCycle = result;
      saveSurgeonState(state);
      return result;
    } finally {
      activeCyclePromise = null;
    }
  })();

  return activeCyclePromise;
}

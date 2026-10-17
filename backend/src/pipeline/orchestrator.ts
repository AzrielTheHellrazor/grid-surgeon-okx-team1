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
    selectedInstId: 'AVAX-USDT-SWAP',
    selectedBar: '1m',
    autoPilotEnabled: true,
    autoPilotIntervalSec: 6,
    contractAddress: '0x7c52f6b7b588698700abbac6cbe37f3cfca305cd',
    activeGridBot: {
      algoId: 'NONE',
      instId: 'AVAX-USDT-SWAP',
      algoOrdType: 'contract_grid',
      direction: 'neutral',
      status: 'RUNNING',
      minPx: 0,
      maxPx: 0,
      gridNum: 12,
      gridLevels: [],
      leverage: 3,
      investmentUsdt: 0,
      tpTriggerPx: 0,
      slTriggerPx: 0,
      liquidationPx: 0,
      unrealizedPnlUsdt: 0,
      gridProfitUsdt: 0,
      amendCount: 0,
      createdAt: new Date().toISOString(),
      lastAmendedAt: new Date().toISOString(),
    },
    surgeryHistory: [],
    activeTrapPosition: null,
    profitSweepHistory: [],
    anchorHistory: [],
    cliHistory: [],
    treasury: {
      tradingAccountUsdt: 0,
      fundingAccountUsdt: 0,
      lockedSimpleEarnUsdt: 0,
      simpleEarnApyPct: 0,
      totalNavUsdt: 0,
      highWaterMarkNavUsdt: 0,
      cumulativeRealizedPnlUsdt: 0,
      totalProfitSweptCount: 0,
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
        if (!loaded.selectedInstId) loaded.selectedInstId = 'AVAX-USDT-SWAP';
        if (!loaded.selectedBar) {
          loaded.selectedBar = '1m';
          loaded.autoPilotIntervalSec = 6;
          if (loaded.activeGridBot) {
            loaded.activeGridBot.minPx = 0;
            loaded.activeGridBot.maxPx = 0;
          }
        }
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
      const targetInstId = state.selectedInstId || 'AVAX-USDT-SWAP';
      const targetBar = state.selectedBar || '1m';

      // BORDER 1: Multi-Modal OKX CLI Sensing
      const border1Sense = await runPhase1Sense(
        scenario,
        targetInstId,
        targetBar
      );

      // Initialize or recenter grid bot bounds if empty or if base coin changed
      const prevBase = (state.activeGridBot?.instId || '').split('-')[0];
      const nextBase = border1Sense.instId.split('-')[0];
      if (
        state.activeGridBot &&
        (state.activeGridBot.minPx === 0 || prevBase !== nextBase)
      ) {
        const atr = border1Sense.technicals.atr14;
        const lastPx = border1Sense.market.lastPx;
        state.activeGridBot.instId = border1Sense.instId;
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

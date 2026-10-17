import cors from 'cors';
import express from 'express';
import {
  executeFullPipelineCycle,
  getSurgeonState,
  recordBroadcastTxHash,
  saveSurgeonState,
  updateContractAddress,
} from './pipeline/orchestrator';
import {
  buildERC8004AgentPassport,
  getOrCreateOperatorWallet,
} from './pipeline/phase4Anchor';
import { ScenarioMode } from './pipeline/types';

const app = express();
const PORT = Number(process.env.PORT || 4001);

app.use(cors());
app.use(express.json());

let autoPilotTimer: NodeJS.Timeout | null = null;

function syncAutoPilotTimer() {
  const state = getSurgeonState();
  if (autoPilotTimer) {
    clearInterval(autoPilotTimer);
    autoPilotTimer = null;
  }
  if (state.autoPilotEnabled) {
    autoPilotTimer = setInterval(() => {
      executeFullPipelineCycle('LIVE').catch((err) => {
        console.error('[AutoPilot Cycle Error Caught]:', err);
      });
    }, (state.autoPilotIntervalSec || 20) * 1000);
  }
}

app.get('/.well-known/agent-card.json', (_req, res) => {
  const state = getSurgeonState();
  const { address } = getOrCreateOperatorWallet();
  const latestHash =
    state.latestCycle?.border4Anchor?.anchorRecord?.reasoningHash ||
    '0x7e2539ef9428d486f98761b92cbc3d6e027cdbe954c8adc4275fa8d143f6110b';
  const passport = buildERC8004AgentPassport(
    address,
    state.contractAddress,
    latestHash,
    state
  );
  res.json(passport.agentCardJson);
});

app.get('/api/erc8004', (_req, res) => {
  const state = getSurgeonState();
  const { address } = getOrCreateOperatorWallet();
  const latestHash =
    state.latestCycle?.border4Anchor?.anchorRecord?.reasoningHash ||
    '0x7e2539ef9428d486f98761b92cbc3d6e027cdbe954c8adc4275fa8d143f6110b';
  const passport = buildERC8004AgentPassport(
    address,
    state.contractAddress,
    latestHash,
    state
  );
  res.json({
    ok: true,
    passport,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'grid-surgeon-backend',
    port: PORT,
    erc8004AgentCard: `http://localhost:${PORT}/.well-known/agent-card.json`,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', async (_req, res) => {
  try {
    let state = getSurgeonState();
    if (!state.latestCycle) {
      await executeFullPipelineCycle('LIVE');
      state = getSurgeonState();
    }
    res.json({
      ok: true,
      state,
      latestCycle: state.latestCycle,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.post('/api/cycle', async (_req, res) => {
  try {
    const cycle = await executeFullPipelineCycle('LIVE');
    const state = getSurgeonState();
    res.json({
      ok: true,
      cycle,
      state,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Pipeline cycle error',
    });
  }
});

app.post('/api/scenario', async (req, res) => {
  try {
    const rawScenario = String(req.body?.scenario || 'LIVE').toUpperCase();
    const validScenarios: ScenarioMode[] = [
      'LIVE',
      'DRIFT_SURGERY',
      'BULL_TRAP',
      'PROFIT_SWEEP',
      'MACRO_BUNKER',
    ];
    const scenario: ScenarioMode = validScenarios.includes(
      rawScenario as ScenarioMode
    )
      ? (rawScenario as ScenarioMode)
      : 'LIVE';

    const cycle = await executeFullPipelineCycle(scenario);
    const state = getSurgeonState();
    res.json({
      ok: true,
      scenario,
      cycle,
      state,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Scenario execution error',
    });
  }
});

app.post('/api/autopilot', (req, res) => {
  const state = getSurgeonState();
  const enabled =
    typeof req.body?.enabled === 'boolean'
      ? req.body.enabled
      : !state.autoPilotEnabled;
  state.autoPilotEnabled = enabled;
  saveSurgeonState(state);
  syncAutoPilotTimer();
  res.json({
    ok: true,
    autoPilotEnabled: state.autoPilotEnabled,
    intervalSec: state.autoPilotIntervalSec,
    state,
  });
});

app.post('/api/contract', (req, res) => {
  const { contractAddress, anchorId, txHash } = req.body || {};
  let state = getSurgeonState();
  if (typeof contractAddress === 'string' && contractAddress.startsWith('0x')) {
    state = updateContractAddress(contractAddress);
  }
  if (typeof anchorId === 'string' && typeof txHash === 'string') {
    state = recordBroadcastTxHash(anchorId, txHash);
  }
  res.json({
    ok: true,
    state,
  });
});

app.listen(PORT, () => {
  console.log(
    `\n======================================================================`
  );
  console.log(
    `⚡ GRID-SURGEON 4-BORDER PIPELINE BACKEND LIVE ON http://localhost:${PORT}`
  );
  console.log(
    `   Border 1: SENSE (OKX ATK CLI) -> Border 2: BRAIN -> Border 3: EXECUTE -> Border 4: AVALANCHE`
  );
  console.log(
    `======================================================================\n`
  );

  // Trigger initial live cycle immediately on startup
  executeFullPipelineCycle('LIVE')
    .then((c) => {
      console.log(
        `[Initial Pipeline Cycle #${c.cycleNumber} Complete] AVAX=$${c.border1Sense.market.lastPx} | Regime=${c.border2Brain.regime} | D_trap=${c.border2Brain.formulas.dTrap} | Hash=${c.border4Anchor.anchorRecord.reasoningHash.slice(0, 18)}...`
      );
      syncAutoPilotTimer();
    })
    .catch((err) => {
      console.error('[Initial Cycle Error]:', err);
    });
});

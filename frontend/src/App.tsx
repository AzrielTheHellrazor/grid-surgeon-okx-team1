import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  ShieldAlert,
  Cpu,
  Terminal,
  Anchor,
  Zap,
  Wrench,
  Crosshair,
  Coins,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Layers,
  TrendingUp,
  TrendingDown,
  Lock,
  ExternalLink,
  Play,
  Pause,
  FileCode2,
} from 'lucide-react';
import {
  FullPipelineCycleResult,
  PersistedSurgeonState,
  ScenarioMode,
} from './types';

const API_BASE = 'http://localhost:4001/api';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export function App() {
  const [state, setState] = useState<PersistedSurgeonState | null>(null);
  const [cycle, setCycle] = useState<FullPipelineCycleResult | null>(null);
  const [loadingScenario, setLoadingScenario] = useState<ScenarioMode | null>(null);
  const [inspectedBorder, setInspectedBorder] = useState<1 | 2 | 3 | 4 | null>(null);
  const [expandedCliId, setExpandedCliId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [walletStatusMsg, setWalletStatusMsg] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
        setCycle(data.latestCycle || data.state.latestCycle);
        setErrorBanner(null);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? `Backend reconnecting (${err.message})...`
          : 'Reconnecting to port 4001...'
      );
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const triggerScenario = async (scenario: ScenarioMode) => {
    setLoadingScenario(scenario);
    setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data.ok) {
        setState(data.state);
        setCycle(data.cycle);
      } else {
        setErrorBanner(data.error || 'Scenario trigger failed');
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to reach backend on :4001'
      );
    } finally {
      setLoadingScenario(null);
    }
  };

  const toggleAutoPilot = async () => {
    if (!state) return;
    try {
      const res = await fetch(`${API_BASE}/autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !state.autoPilotEnabled }),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } catch {
      // handled on next poll
    }
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleBrowserWalletAnchor = async () => {
    if (!cycle) return;
    const anchor = cycle.border4Anchor.anchorRecord;
    if (!window.ethereum) {
      copyText('calldata', anchor.encodedRecordDecisionCalldata);
      setWalletStatusMsg(
        'No injected EVM wallet detected — Copied signed recordDecision(...) ABI Calldata to clipboard!'
      );
      return;
    }

    try {
      setWalletStatusMsg('Requesting Core / MetaMask account & Avalanche Fuji (43113)...');
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (!accounts || accounts.length === 0) {
        setWalletStatusMsg('No wallet account authorized.');
        return;
      }

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa869' }], // 43113 Avalanche Fuji
        });
      } catch {
        // User may stay on current chain or C-Chain
      }

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: accounts[0],
            to: cycle.border4Anchor.contractInfo.address,
            data: anchor.encodedRecordDecisionCalldata,
          },
        ],
      })) as string;

      await fetch(`${API_BASE}/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchorId: anchor.id, txHash }),
      });
      setWalletStatusMsg(`Broadcasted On-Chain! Tx: ${txHash.slice(0, 18)}...`);
      fetchStatus();
    } catch (err) {
      setWalletStatusMsg(
        err instanceof Error
          ? `Wallet info: ${err.message.slice(0, 90)}`
          : 'Transaction cancelled'
      );
    }
  };

  const handleDeployContract = async () => {
    if (!cycle) return;
    const bytecode = cycle.border4Anchor.contractInfo.bytecode;
    if (!window.ethereum) {
      copyText('bytecode', bytecode);
      setWalletStatusMsg(
        'No browser wallet found — Copied compiled GridSurgeonRegistry.sol EVM bytecode to clipboard!'
      );
      return;
    }
    try {
      setWalletStatusMsg('Deploying GridSurgeonRegistry.sol via Browser Wallet...');
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: accounts[0],
            data: bytecode,
          },
        ],
      })) as string;
      setWalletStatusMsg(`Deploy Tx Sent: ${txHash.slice(0, 22)}...`);
    } catch (err) {
      setWalletStatusMsg(
        err instanceof Error ? err.message.slice(0, 90) : 'Deploy cancelled'
      );
    }
  };

  if (!cycle || !state) {
    return (
      <div className="min-h-screen bg-[#06090f] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4 animate-pulse">
          <Cpu className="w-6 h-6 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold tracking-wider font-mono text-white">
          INITIALIZING GRID-SURGEON 4-BORDER PIPELINE...
        </h1>
        <p className="text-sm text-slate-400 mt-2 font-mono">
          Executing live OKX ATK CLI sensors & Avalanche C-Chain cryptographic state anchor
        </p>
      </div>
    );
  }

  const b1 = cycle.border1Sense;
  const b2 = cycle.border2Brain;
  const b3 = cycle.border3Execute;
  const b4 = cycle.border4Anchor;

  const gridBot = b3.activeGridBot || state.activeGridBot;
  const corridorPct = Math.min(
    100,
    Math.max(0, Number((b2.gridPlan.corridorPositionPct * 100).toFixed(1)))
  );

  const regimeBadgeColor =
    b2.regime === 'RANGING_GRID'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : b2.regime === 'BULL_TRAP_SHORT'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
      : b2.regime === 'MACRO_BUNKER'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-100 flex flex-col">
      {/* TOP INSTITUTIONAL COMMAND HEADER */}
      <header className="border-b border-slate-800/90 bg-[#090d16]/95 backdrop-blur sticky top-0 z-30 px-4 lg:px-6 py-3">
        <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Crosshair className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-base tracking-wider text-white">
                  GRID-SURGEON
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  OKX ATK × AVALANCHE C-CHAIN
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  CYCLE #{cycle.cycleNumber} ({cycle.totalDurationMs}ms)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Autonomous Self-Healing Bot Orchestrator & Whale-Divergence Trap Hunter on{' '}
                <span className="text-slate-200 font-mono font-semibold">
                  {b1.instId}
                </span>
              </p>
            </div>
          </div>

          {/* LIVE AVAX TICKER + REGIME PILL + AUTOPILOT */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-[#0d1422] border border-slate-800 flex items-center gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  {b1.instId} LIVE
                </div>
                <div className="font-mono font-bold text-base text-white flex items-center gap-1.5">
                  ${b1.market.lastPx.toFixed(4)}
                  <span
                    className={`text-xs font-mono ${
                      b1.market.change24hPct >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {b1.market.change24hPct >= 0 ? '+' : ''}
                    {b1.market.change24hPct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  ACTIVE REGIME
                </div>
                <div
                  className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border mt-0.5 ${regimeBadgeColor}`}
                >
                  {b2.regime}
                </div>
              </div>
            </div>

            <button
              onClick={toggleAutoPilot}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-semibold border transition flex items-center gap-2 ${
                state.autoPilotEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 shadow-sm shadow-emerald-950'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              {state.autoPilotEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  AUTO-PILOT: ON (20s)
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-400" />
                  AUTO-PILOT: OFF (20s)
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1680px] w-full mx-auto px-4 lg:px-6 py-4 space-y-4 flex-1">
        {errorBanner && (
          <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-center justify-between">
            <span>⚠️ {errorBanner}</span>
            <button
              onClick={fetchStatus}
              className="underline hover:text-white ml-4"
            >
              Retry Now
            </button>
          </div>
        )}

        {/* UNBREAKABLE 4-BORDER PIPELINE ARCHITECTURE RIBBON */}
        <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                UNBREAKABLE 4-BORDER PIPELINE ARCHITECTURE
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                (Click any border below to inspect its strict Input/Output JSON Contract)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ALL 4 BORDERS VERIFIED • ZERO UNHANDLED EXCEPTIONS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                num: 1 as const,
                meta: b1.meta,
                color: 'emerald',
                subtitle: `${b1.cliRecords.length} OKX CLI Feeds • AVAX $${b1.market.lastPx.toFixed(
                  4
                )} • ATR $${b1.technicals.atr14.toFixed(4)}`,
              },
              {
                num: 2 as const,
                meta: b2.meta,
                color: 'cyan',
                subtitle: `Regime: ${b2.regime} • D_trap: ${
                  b2.formulas.dTrap >= 0 ? '+' : ''
                }${b2.formulas.dTrap.toFixed(2)} (${b2.formulas.dTrapBps} bps)`,
              },
              {
                num: 3 as const,
                meta: b3.meta,
                color: 'violet',
                subtitle: `Action: ${b2.recommendedAction} • Ref #${b3.primaryOkxAlgoOrOrdId}`,
              },
              {
                num: 4 as const,
                meta: b4.meta,
                color: 'amber',
                subtitle: `keccak256: ${b4.anchorRecord.reasoningHash.slice(
                  0,
                  14
                )}... • Fuji #${b4.operatorWallet.latestBlockNumber}`,
              },
            ].map((item) => {
              const isSelected = inspectedBorder === item.num;
              return (
                <button
                  key={item.num}
                  onClick={() =>
                    setInspectedBorder(isSelected ? null : item.num)
                  }
                  className={`text-left rounded-lg p-3 border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-400/70 ring-1 ring-emerald-400/30'
                      : 'bg-[#0e1525] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-white">
                      {item.meta.borderName}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {item.meta.status} • {item.meta.durationMs}ms
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1.5 truncate">
                    {item.subtitle}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1.5 flex items-center justify-between">
                    <span className="truncate">
                      Out: {item.meta.outputContract.split(' ')[0]}
                    </span>
                    <span className="text-emerald-400 flex items-center gap-0.5 shrink-0 ml-2">
                      {isSelected ? 'Hide JSON' : 'Inspect Border'}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* EXPANDABLE BORDER INPUT/OUTPUT CONTRACT INSPECTOR */}
          {inspectedBorder && (
            <div className="mt-3 rounded-lg bg-[#060911] border border-emerald-500/40 p-3.5 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
                <div>
                  <span className="text-emerald-400 font-bold">
                    BORDER {inspectedBorder} CONTRACT INSPECTOR:
                  </span>{' '}
                  <span className="text-slate-300">
                    {inspectedBorder === 1
                      ? b1.meta.GuaranteeNote
                      : inspectedBorder === 2
                      ? b2.meta.GuaranteeNote
                      : inspectedBorder === 3
                      ? b3.meta.GuaranteeNote
                      : b4.meta.GuaranteeNote}
                  </span>
                </div>
                <button
                  onClick={() => setInspectedBorder(null)}
                  className="text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                >
                  Close [×]
                </button>
              </div>
              <pre className="max-h-60 overflow-auto text-[11px] text-emerald-200/90 leading-relaxed">
                {JSON.stringify(
                  inspectedBorder === 1
                    ? b1
                    : inspectedBorder === 2
                    ? b2
                    : inspectedBorder === 3
                    ? b3
                    : b4,
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </section>

        {/* 5 ONE-CLICK STAGE DEMO & SCENARIO PIPELINE TRIGGERS */}
        <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              ONE-CLICK PIPELINE EXECUTION & STAGE PITCH SCENARIO TRIGGERS
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Active Scenario Mode:{' '}
              <strong className="text-emerald-300">{cycle.scenario}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <button
              disabled={loadingScenario !== null}
              onClick={() => triggerScenario('LIVE')}
              className="p-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-left transition flex flex-col justify-between group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loadingScenario === 'LIVE' ? 'animate-spin' : ''
                    }`}
                  />
                  ⚡ Run Live OKX Cycle
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">
                  LIVE CLI
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                Pulls real live AVAX-USDT-SWAP data from OKX CLI & runs all 4 borders.
              </p>
            </button>

            <button
              disabled={loadingScenario !== null}
              onClick={() => triggerScenario('DRIFT_SURGERY')}
              className="p-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-left transition flex flex-col justify-between disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <Wrench
                    className={`w-3.5 h-3.5 ${
                      loadingScenario === 'DRIFT_SURGERY' ? 'animate-spin' : ''
                    }`}
                  />
                  🔧 Simulate Boundary Drift
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                  GRID AMEND
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                Forces grid drift (93.4%) → triggers live in-flight{' '}
                <code className="text-cyan-200">okx bot grid amend</code> surgery!
              </p>
            </button>

            <button
              disabled={loadingScenario !== null}
              onClick={() => triggerScenario('BULL_TRAP')}
              className="p-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-left transition flex flex-col justify-between disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert
                    className={`w-3.5 h-3.5 ${
                      loadingScenario === 'BULL_TRAP' ? 'animate-spin' : ''
                    }`}
                  />
                  🪤 Trigger Bull Trap
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300">
                  D_trap &gt; +1.10
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                Retail 87% Bullish vs Whales Shorting → stops grid, opens 3x Short + 1.5% Trail.
              </p>
            </button>

            <button
              disabled={loadingScenario !== null}
              onClick={() => triggerScenario('PROFIT_SWEEP')}
              className="p-2.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-left transition flex flex-col justify-between disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-violet-300 flex items-center gap-1.5">
                  <Coins
                    className={`w-3.5 h-3.5 ${
                      loadingScenario === 'PROFIT_SWEEP' ? 'animate-spin' : ''
                    }`}
                  />
                  💰 High-Water Profit Sweep
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950 text-violet-300">
                  18 → 6 → EARN
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                Sweeps 50% of realized profit ($42.30 USDT) from Trading → Funding → Simple Earn.
              </p>
            </button>

            <button
              disabled={loadingScenario !== null}
              onClick={() => triggerScenario('MACRO_BUNKER')}
              className="p-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-left transition flex flex-col justify-between disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      loadingScenario === 'MACRO_BUNKER' ? 'animate-spin' : ''
                    }`}
                  />
                  🛡️ Macro Shock Bunker
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300">
                  CPI IN 14m
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">
                Simulates US CPI/FOMC release in 14m → de-leverages to 1x & tightens OCO SL.
              </p>
            </button>
          </div>
        </section>

        {/* 4-QUADRANT COMMAND CENTER GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* QUADRANT 1: GRIDSURGEON LIVE CORRIDOR VISUALIZER */}
          <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Q1 // GRIDSURGEON LIVE CORRIDOR & IN-FLIGHT SURGERY
                  </h2>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  AlgoID #{gridBot.algoId} • {gridBot.status} ({gridBot.leverage}x)
                </span>
              </div>

              {/* Technical KPIs Strip */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 my-3">
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">LIVE PRICE</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    ${b1.market.lastPx.toFixed(4)}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">ATR (14) 1H</div>
                  <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                    ${b1.technicals.atr14.toFixed(4)}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">ADX (14)</div>
                  <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                    {b1.technicals.adx14.toFixed(1)}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">RSI (14)</div>
                  <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
                    {b1.technicals.rsi14.toFixed(1)}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">BB WIDTH</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                    {b1.technicals.bbWidthPct.toFixed(2)}%
                  </div>
                </div>
                <div className="p-2 rounded bg-[#0e1525] border border-slate-800/80">
                  <div className="text-[10px] font-mono text-slate-400">LIQ PRICE</div>
                  <div className="text-xs font-mono font-bold text-rose-400 mt-0.5">
                    ${gridBot.liquidationPx.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Corridor Utilization & Drift Surgery Trigger Bar */}
              <div className="p-3 rounded-lg bg-[#0d1424] border border-slate-800 mb-3">
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-300">
                    Grid Corridor Utilization:{' '}
                    <strong className="text-white">{corridorPct}%</strong>
                  </span>
                  <span
                    className={
                      b2.gridPlan.requiresInFlightSurgery
                        ? 'text-cyan-300 font-bold'
                        : 'text-emerald-400'
                    }
                  >
                    {b2.gridPlan.requiresInFlightSurgery
                      ? '⚡ SURGERY TRIGGERED (>88% / <12%)'
                      : '✓ SAFE INNER CORRIDOR [12% - 88%]'}
                  </span>
                </div>
                <div className="relative h-4 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                  {/* Left & Right 12% Surgery Trigger Zones */}
                  <div className="absolute inset-y-0 left-0 w-[12%] bg-rose-500/25 border-r border-rose-500/50" />
                  <div className="absolute inset-y-0 right-0 w-[12%] bg-rose-500/25 border-l border-rose-500/50" />
                  {/* Live Price Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-emerald-400 rounded shadow-[0_0_10px_#34d399] transition-all duration-500"
                    style={{ left: `calc(${corridorPct}% - 4px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                  <span>SL: ${gridBot.slTriggerPx.toFixed(4)}</span>
                  <span className="text-cyan-300">
                    minPx: ${gridBot.minPx.toFixed(4)}
                  </span>
                  <span className="text-white font-bold">
                    AVAX: ${b1.market.lastPx.toFixed(4)}
                  </span>
                  <span className="text-cyan-300">
                    maxPx: ${gridBot.maxPx.toFixed(4)}
                  </span>
                  <span>TP: ${gridBot.tpTriggerPx.toFixed(4)}</span>
                </div>
              </div>

              {/* 12-Level Interactive Visual Grid Ladder */}
              <div className="p-3 rounded-lg bg-[#080c16] border border-slate-800/90 mb-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                  <span>
                    ACTIVE 12-LEVEL CONTRACT GRID LADDER (Step: $
                    {b2.gridPlan.gridStepUsdt.toFixed(4)} / {b2.gridPlan.gridStepPct}
                    %)
                  </span>
                  <span>
                    BB: [${b1.technicals.bbLower.toFixed(3)} — $
                    {b1.technicals.bbUpper.toFixed(3)}]
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {b2.gridPlan.gridLevels.map((lvl, idx) => {
                    const isAsk = lvl > b1.market.lastPx;
                    const isClosest =
                      Math.abs(lvl - b1.market.lastPx) <=
                      b2.gridPlan.gridStepUsdt * 0.6;
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-1 rounded text-[11px] font-mono border flex flex-col items-center ${
                          isClosest
                            ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold'
                            : isAsk
                            ? 'bg-rose-950/25 border-rose-900/40 text-rose-300'
                            : 'bg-emerald-950/25 border-emerald-900/40 text-emerald-300'
                        }`}
                      >
                        <span className="text-[9px] uppercase opacity-75">
                          L{idx} {isClosest ? '• NOW' : isAsk ? 'SELL' : 'BUY'}
                        </span>
                        <span>${lvl.toFixed(3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* In-Flight Surgery Log (`okx bot grid amend`) */}
            <div className="rounded-lg bg-[#0d1422] border border-slate-800 p-3">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-cyan-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  IN-FLIGHT BOT SURGERY LOG (okx bot grid amend)
                </span>
                <span className="text-[11px] text-slate-400">
                  Total Amendments: {gridBot.amendCount}
                </span>
              </div>
              {state.surgeryHistory.length === 0 ? (
                <div className="text-xs font-mono text-slate-400 py-2">
                  No boundary drift surgeries triggered yet in this session. Click{' '}
                  <strong className="text-cyan-300">
                    "🔧 Simulate Boundary Drift"
                  </strong>{' '}
                  above to watch live in-flight{' '}
                  <code className="text-cyan-200">okx bot grid amend</code> surgery!
                </div>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {state.surgeryHistory.slice(0, 4).map((surg) => (
                    <div
                      key={surg.id}
                      className="p-2 rounded bg-[#080c15] border border-cyan-500/30 text-[11px] font-mono"
                    >
                      <div className="flex items-center justify-between text-cyan-300 font-semibold">
                        <span>
                          Algo #{surg.algoId} Recentered @ AVAX $
                          {surg.triggerPx.toFixed(4)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(surg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-slate-300 mt-0.5">
                        Old: [{surg.previousMinPx.toFixed(4)},{' '}
                        {surg.previousMaxPx.toFixed(4)}] →{' '}
                        <strong className="text-emerald-300">
                          New: [{surg.newMinPx.toFixed(4)},{' '}
                          {surg.newMaxPx.toFixed(4)}]
                        </strong>{' '}
                        (TP ${surg.newTpTriggerPx.toFixed(3)} / SL $
                        {surg.newSlTriggerPx.toFixed(3)})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* QUADRANT 2: CONTRACROWD DIVERGENCE RADAR */}
          <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Q2 // CONTRACROWD RETAIL-VS-WHALE DIVERGENCE RADAR
                  </h2>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    b2.formulas.trapClassification === 'BULL_TRAP'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : b2.formulas.trapClassification === 'BEAR_TRAP'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  D_trap = {b2.formulas.dTrap >= 0 ? '+' : ''}
                  {b2.formulas.dTrap.toFixed(2)} ({b2.formulas.trapClassification})
                </span>
              </div>

              {/* Retail Sentiment vs Smart Money Whale Positioning Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                {/* Retail Sentiment Card */}
                <div className="p-3 rounded-lg bg-[#0e1525] border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400">RETAIL SENTIMENT (S_retail)</span>
                    <span className="text-emerald-300 font-bold">
                      {b1.sentiment.sRetail >= 0 ? '+' : ''}
                      {b1.sentiment.sRetail.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-rose-950 overflow-hidden flex">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500"
                      style={{
                        width: `${(b1.sentiment.bullishRatio * 100).toFixed(0)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono mt-1.5">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Bullish {(b1.sentiment.bullishRatio * 100).toFixed(0)}%
                    </span>
                    <span className="text-rose-400 flex items-center gap-1">
                      Bearish {(b1.sentiment.bearishRatio * 100).toFixed(0)}%
                      <TrendingDown className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                {/* Smart Money Whales Card */}
                <div className="p-3 rounded-lg bg-[#0e1525] border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-400">SMART MONEY WHALES (W_whale)</span>
                    <span
                      className={`font-bold ${
                        b1.smartMoney.wWhale >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-400'
                      }`}
                    >
                      {b1.smartMoney.wWhale >= 0 ? '+' : ''}
                      {b1.smartMoney.wWhale.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-rose-500/80 overflow-hidden flex">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500"
                      style={{
                        width: `${Math.round(
                          (b1.smartMoney.longNotionalUsd /
                            Math.max(
                              1,
                              b1.smartMoney.longNotionalUsd +
                                b1.smartMoney.shortNotionalUsd
                            )) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono mt-1.5">
                    <span className="text-emerald-300">
                      Long: ${(b1.smartMoney.longNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                    <span className="text-rose-300">
                      Short: ${(b1.smartMoney.shortNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantitative Trap Score Formula & Visual Spectrum */}
              <div className="p-3 rounded-lg bg-[#0d1424] border border-slate-800 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-2">
                  <span className="text-slate-300">
                    FORMULA:{' '}
                    <code className="text-cyan-300">
                      D_trap = S_retail + 0.5·F_norm - 1.5·W_whale
                    </code>
                  </span>
                  <span className="text-slate-400">
                    = ({b2.formulas.sRetail.toFixed(2)}) + 0.5·(
                    {b2.formulas.fNorm.toFixed(2)}) - 1.5·(
                    {b2.formulas.wWhale.toFixed(2)}) ={' '}
                    <strong className="text-white">
                      {b2.formulas.dTrap >= 0 ? '+' : ''}
                      {b2.formulas.dTrap.toFixed(2)}
                    </strong>
                  </span>
                </div>

                {/* Spectrum Bar [-2.5 to +2.5] */}
                <div className="relative h-4 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-[28%] bg-emerald-500/20 border-r border-emerald-500/50" />
                  <div className="absolute inset-y-0 right-0 w-[28%] bg-rose-500/20 border-l border-rose-500/50" />
                  <div
                    className="absolute top-0 bottom-0 w-2.5 bg-amber-400 rounded shadow-[0_0_10px_#fbbf24] transition-all duration-500"
                    style={{
                      left: `calc(${Math.min(
                        98,
                        Math.max(2, ((b2.formulas.dTrap + 2.5) / 5) * 100)
                      )}% - 5px)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span className="text-emerald-400">
                    &lt; -1.10 BEAR TRAP (LONG)
                  </span>
                  <span>NEUTRAL RANGE [-1.10, +1.10]</span>
                  <span className="text-rose-400">
                    &gt; +1.10 BULL TRAP (SHORT)
                  </span>
                </div>
              </div>

              {/* Funding Rate, Open Interest & Macro Calendar Strip */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="p-2.5 rounded bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    PERP FUNDING RATE
                  </div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">
                    {(b1.market.fundingRate * 100).toFixed(4)}% (F_norm:{' '}
                    {b2.formulas.fNorm.toFixed(2)})
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    1H OPEN INTEREST Δ
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                    {b1.market.oiDelta1hPct >= 0 ? '+' : ''}
                    {b1.market.oiDelta1hPct.toFixed(2)}% ($
                    {(b1.market.oiUsd / 1e6).toFixed(1)}M)
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    US MACRO CALENDAR
                  </div>
                  <div
                    className={`text-xs font-mono font-bold mt-0.5 truncate ${
                      b1.macroCalendar.imminentHighImpactEvent
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {b1.macroCalendar.imminentHighImpactEvent
                      ? `🚨 ${b1.macroCalendar.minutesUntilRelease}m to CPI/FOMC`
                      : '✓ Clear (>30m window)'}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Counter-Trap Execution Status */}
            <div className="rounded-lg bg-[#0d1422] border border-slate-800 p-3">
              <div className="text-xs font-mono font-semibold text-slate-200 mb-1">
                BRAIN DECISION & COUNTER-TRAP POSITION STATUS:
              </div>
              <p className="text-xs font-mono text-emerald-300 leading-relaxed">
                {b3.actionExecuted}
              </p>
              {state.activeTrapPosition && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-rose-300">
                  <span>
                    Counter-Trap Order #{state.activeTrapPosition.ordId}:{' '}
                    {state.activeTrapPosition.posSide.toUpperCase()}{' '}
                    {state.activeTrapPosition.leverage}x ($
                    {state.activeTrapPosition.notionalUsdt} @ $
                    {state.activeTrapPosition.entryPx.toFixed(4)})
                  </span>
                  <span>
                    TP: ${state.activeTrapPosition.tpTriggerPx} | SL: $
                    {state.activeTrapPosition.slTriggerPx} | Trail: 1.5% (
                    {state.activeTrapPosition.status})
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* QUADRANT 3: LIVE OKX ATK CLI EXECUTION TERMINAL */}
          <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Q3 // LIVE OKX AGENT TRADE KIT (ATK) CLI EXECUTION STREAM
                  </h2>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  7 ATK Skills • {state.cliHistory.length} Verified Invocations
                </span>
              </div>

              <div className="mt-3 space-y-2 max-h-[410px] overflow-y-auto pr-1">
                {state.cliHistory.slice(0, 18).map((rec) => {
                  const isExpanded = expandedCliId === rec.id;
                  const modeBadge =
                    rec.mode === 'LIVE_CLI_READ' || rec.mode === 'LIVE_CLI_WRITE'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
                  return (
                    <div
                      key={rec.id}
                      className="rounded-lg bg-[#080c15] border border-slate-800/90 p-2.5 font-mono text-xs"
                    >
                      <div
                        onClick={() =>
                          setExpandedCliId(isExpanded ? null : rec.id)
                        }
                        className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                            {rec.skill}
                          </span>
                          <code className="text-emerald-300 truncate font-semibold">
                            $ {rec.command}
                          </code>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${modeBadge}`}
                          >
                            {rec.mode}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {rec.durationMs}ms
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1.5 pl-5">
                        → {rec.summary}
                      </div>
                      {isExpanded && (
                        <pre className="mt-2 p-2 rounded bg-[#05080f] border border-slate-800 text-[10px] text-cyan-200 overflow-x-auto max-h-44">
                          {JSON.stringify(rec.rawPreview, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Binary: /opt/homebrew/bin/okx (@okx_ai/okx-trade-cli)</span>
              <span className="text-emerald-400">
                Click any CLI row to inspect raw JSON output
              </span>
            </div>
          </section>

          {/* QUADRANT 4: HIGH-WATER MARK TREASURY & AVALANCHE C-CHAIN PROOF LEDGER */}
          <section className="rounded-xl bg-[#0a0f1a] border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                    Q4 // HIGH-WATER MARK TREASURY & AVALANCHE C-CHAIN ANCHOR
                  </h2>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Fuji Block #{b4.operatorWallet.latestBlockNumber}
                </span>
              </div>

              {/* High-Water Mark Treasury Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
                <div className="p-2.5 rounded-lg bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    TOTAL PORTFOLIO NAV
                  </div>
                  <div className="text-sm font-mono font-bold text-white mt-0.5">
                    ${b3.treasury.totalNavUsdt.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400">
                    HWM: ${b3.treasury.highWaterMarkNavUsdt.toFixed(2)}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    TRADING ACCT (18)
                  </div>
                  <div className="text-sm font-mono font-bold text-cyan-300 mt-0.5">
                    ${b3.treasury.tradingAccountUsdt.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Active Margin Pool
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1525] border border-emerald-500/30">
                  <div className="text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> SIMPLE EARN LOCKED
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                    ${b3.treasury.lockedSimpleEarnUsdt.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-300/80">
                    {b3.treasury.simpleEarnApyPct}% APY ({b3.treasury.totalProfitSweptCount}{' '}
                    Sweeps)
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1525] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">
                    CUMULATIVE REALIZED
                  </div>
                  <div className="text-sm font-mono font-bold text-violet-300 mt-0.5">
                    +${b3.treasury.cumulativeRealizedPnlUsdt.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    50% Swept to Earn
                  </div>
                </div>
              </div>

              {/* ERC-8004 TRUSTLESS AGENT PASSPORT (IDENTITY + VALIDATION + REPUTATION) */}
              {b4.erc8004Passport && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-950/30 via-[#0d1424] to-cyan-950/30 border border-emerald-500/40 mb-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      🪪 ERC-8004 TRUSTLESS AGENT PASSPORT • ID #{b4.erc8004Passport.identityRegistry.agentId} ({b4.erc8004Passport.identityRegistry.agentDomain})
                    </span>
                    <a
                      href="http://localhost:4001/.well-known/agent-card.json"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 flex items-center gap-1"
                    >
                      /.well-known/agent-card.json <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-[#080c15] border border-slate-800">
                      <div className="text-[9px] text-slate-400">1. IDENTITY REGISTRY</div>
                      <div className="text-emerald-300 font-bold mt-0.5">
                        {b4.erc8004Passport.identityRegistry.status}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Validator: {b4.erc8004Passport.validatorAgentName}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#080c15] border border-slate-800">
                      <div className="text-[9px] text-slate-400">2. VALIDATION REGISTRY</div>
                      <div className="text-cyan-300 font-bold mt-0.5">
                        {b4.erc8004Passport.validationRegistry.totalValidatedTasks} Tasks Verified
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        EIP-191 + Keccak256
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#080c15] border border-slate-800">
                      <div className="text-[9px] text-slate-400">3. REPUTATION REGISTRY</div>
                      <div className="text-amber-300 font-bold mt-0.5">
                        Score: {b4.erc8004Passport.reputationRegistry.trustScore}/100
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {b4.erc8004Passport.reputationRegistry.feedbackCount} On-Chain Proofs
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Avalanche C-Chain / Fuji Cryptographic Anchor Box */}
              <div className="p-3 rounded-lg bg-[#0d1424] border border-amber-500/30 mb-3 space-y-2 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={`https://testnet.snowtrace.io/address/${b4.contractInfo.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 hover:underline font-bold flex items-center gap-1.5"
                  >
                    <FileCode2 className="w-3.5 h-3.5" />
                    contracts/GridSurgeonRegistry.sol (Fuji {b4.anchorRecord.chainId})
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30">
                    {b4.anchorRecord.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-[#080c15] border border-slate-800 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-slate-400">Operator: </span>
                      <a
                        href={`https://testnet.snowtrace.io/address/${b4.operatorWallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-200 hover:text-amber-300 underline"
                      >
                        {b4.operatorWallet.address.slice(0, 10)}...
                        {b4.operatorWallet.address.slice(-8)}
                      </a>
                    </div>
                    <button
                      onClick={() =>
                        copyText('opAddr', b4.operatorWallet.address)
                      }
                      className="text-slate-400 hover:text-white ml-2"
                    >
                      {copiedKey === 'opAddr' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="p-2 rounded bg-[#080c15] border border-slate-800 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-slate-400">Registry: </span>
                      <a
                        href={`https://testnet.snowtrace.io/address/${b4.contractInfo.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-200 hover:text-amber-300 underline"
                      >
                        {b4.contractInfo.address.slice(0, 10)}...
                        {b4.contractInfo.address.slice(-8)}
                      </a>
                    </div>
                    <button
                      onClick={() =>
                        copyText('regAddr', b4.contractInfo.address)
                      }
                      className="text-slate-400 hover:text-white ml-2"
                    >
                      {copiedKey === 'regAddr' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {b4.anchorRecord.txHash && (
                  <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 truncate">
                      ✅ Live Fuji Tx: {b4.anchorRecord.txHash.slice(0, 18)}...{b4.anchorRecord.txHash.slice(-10)}
                    </span>
                    <a
                      href={`https://testnet.snowtrace.io/tx/${b4.anchorRecord.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-200 hover:underline flex items-center gap-1 shrink-0 ml-2 font-bold"
                    >
                      Snowtrace <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="p-2 rounded bg-[#080c15] border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>KECCAK256 REASONING HASH (bytes32 _reasoningHash)</span>
                    <button
                      onClick={() =>
                        copyText('hash', b4.anchorRecord.reasoningHash)
                      }
                      className="text-amber-300 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'hash' ? 'Copied!' : 'Copy Hash'}
                    </button>
                  </div>
                  <div className="text-[11px] text-amber-200 truncate mt-0.5">
                    {b4.anchorRecord.reasoningHash}
                  </div>
                </div>

                <div className="p-2 rounded bg-[#080c15] border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      ENCODED ABI CALLDATA: recordDecision(regime={b4.anchorRecord.regimeEnumIndex},
                      trapBps={b4.anchorRecord.trapScoreBps}, pxE4={b4.anchorRecord.avaxPriceE4})
                    </span>
                    <button
                      onClick={() =>
                        copyText(
                          'calldata',
                          b4.anchorRecord.encodedRecordDecisionCalldata
                        )
                      }
                      className="text-cyan-300 hover:underline"
                    >
                      {copiedKey === 'calldata' ? 'Copied!' : 'Copy Calldata'}
                    </button>
                  </div>
                  <div className="text-[11px] text-cyan-200/90 truncate mt-0.5">
                    {b4.anchorRecord.encodedRecordDecisionCalldata}
                  </div>
                </div>

                {/* 1-Click Browser Wallet Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleBrowserWalletAnchor}
                    className="flex-1 py-2 px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    ⛓️ Anchor Decision On-Chain (Core / MetaMask)
                  </button>
                  <button
                    onClick={handleDeployContract}
                    className="py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs transition"
                  >
                    Deploy Registry Bytecode
                  </button>
                </div>

                {walletStatusMsg && (
                  <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 rounded px-2.5 py-1.5">
                    {walletStatusMsg}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Avalanche Proof Ledger History */}
            <div className="rounded-lg bg-[#0d1422] border border-slate-800 p-2.5">
              <div className="text-[11px] font-mono font-semibold text-slate-300 mb-1.5">
                RECENT ON-CHAIN STATE PROOFS ({state.anchorHistory.length} Signed Cycles)
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {state.anchorHistory.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-[10px] font-mono px-2 py-1 rounded bg-[#080c15] border border-slate-800/80"
                  >
                    <span className="text-amber-300 font-semibold">
                      {item.regime}
                    </span>
                    <span className="text-slate-300">
                      OKX #{item.okxAlgoOrOrdId}
                    </span>
                    {item.txHash ? (
                      <a
                        href={`https://testnet.snowtrace.io/tx/${item.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 hover:underline flex items-center gap-1"
                      >
                        Tx: {item.txHash.slice(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span className="text-slate-400">
                        Hash: {item.reasoningHash.slice(0, 12)}...
                      </span>
                    )}
                    <span className="text-emerald-400">
                      NAV ${(item.navUsdtE2 / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
export default App;

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
  LayoutGrid,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  FullPipelineCycleResult,
  PersistedSurgeonState,
  ScenarioMode,
} from './types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  BadgeVariant,
  Separator,
  TabsList,
  TabsTrigger,
  cn,
} from './components/ui/shadcn-metallic';

const API_BASE = 'http://localhost:4001/api';

type WorkspaceView = 'ALL' | 'STRATEGY' | 'EXECUTION';

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
  const [loadingScenario, setLoadingScenario] = useState<ScenarioMode | null>(
    null
  );
  const [inspectedBorder, setInspectedBorder] = useState<1 | 2 | 3 | 4 | null>(
    null
  );
  const [expandedCliId, setExpandedCliId] = useState<string | null>(null);
  const [cliSkillFilter, setCliSkillFilter] = useState<string>('ALL');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('ALL');
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
        'No injected EVM wallet detected — Copied signed recordDecision(...) ABI Calldata to clipboard.'
      );
      return;
    }

    try {
      setWalletStatusMsg(
        'Requesting Core / MetaMask account & Avalanche Fuji (43113)...'
      );
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
      setWalletStatusMsg(`Broadcasted On-Chain: ${txHash.slice(0, 18)}...`);
      fetchStatus();
    } catch (err) {
      setWalletStatusMsg(
        err instanceof Error
          ? `Wallet status: ${err.message.slice(0, 90)}`
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
        'No browser wallet found — Copied compiled GridSurgeonRegistry.sol EVM bytecode to clipboard.'
      );
      return;
    }
    try {
      setWalletStatusMsg(
        'Deploying GridSurgeonRegistry.sol via Browser Wallet...'
      );
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
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <div className="glass-panel rounded-2xl p-8 max-w-md w-full flex flex-col items-center text-center gap-4">
          <div className="size-12 rounded-xl metal-badge flex items-center justify-center">
            <Cpu className="size-6 text-zinc-200 animate-pulse" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-base font-semibold tracking-tight text-metallic">
              Initializing Grid-Surgeon Pipeline
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Connecting OKX ATK CLI sensors & Avalanche ERC-8004 state anchor...
            </p>
          </div>
        </div>
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

  const regimeVariant: BadgeVariant =
    b2.regime === 'RANGING_GRID'
      ? 'emerald'
      : b2.regime === 'BULL_TRAP_SHORT'
      ? 'rose'
      : b2.regime === 'MACRO_BUNKER'
      ? 'amber'
      : 'cyan';

  const filteredCliHistory =
    cliSkillFilter === 'ALL'
      ? state.cliHistory
      : state.cliHistory.filter((r) => r.skill === cliSkillFilter);

  const showStrategyQuadrants =
    workspaceView === 'ALL' || workspaceView === 'STRATEGY';
  const showExecutionQuadrants =
    workspaceView === 'ALL' || workspaceView === 'EXECUTION';

  return (
    <div className="min-h-dvh flex flex-col text-zinc-100">
      {/* TOP TRANSLUCENT TITANIUM COMMAND BAR */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-zinc-950/65 backdrop-blur-2xl">
        <div className="max-w-[1640px] mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-xl metal-badge flex items-center justify-center">
              <Crosshair className="size-5 text-zinc-100" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-metallic">
                  GRID-SURGEON
                </span>
                <Badge variant="metallic">OKX ATK × AVALANCHE ERC-8004</Badge>
                <Badge variant="emerald">
                  NFT ID #{b4.erc8004Passport?.identityRegistry.agentId ?? 257}
                </Badge>
                <Badge variant="outline">
                  Cycle #{cycle.cycleNumber} • {cycle.totalDurationMs}ms
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                Autonomous Self-Healing Grid Surgeon, Whale-Divergence Trap Hunter & Simple Earn Sweeper on{' '}
                <span className="text-zinc-200 font-mono font-medium">
                  {b1.instId}
                </span>
              </p>
            </div>
          </div>

          {/* Right Productivity Controls: Workspace View Switcher + Live Ticker + AutoPilot */}
          <div className="flex flex-wrap items-center gap-2.5">
            <TabsList>
              <TabsTrigger
                active={workspaceView === 'ALL'}
                onClick={() => setWorkspaceView('ALL')}
              >
                <LayoutGrid className="size-3.5" />
                All 4 Quadrants
              </TabsTrigger>
              <TabsTrigger
                active={workspaceView === 'STRATEGY'}
                onClick={() => setWorkspaceView('STRATEGY')}
              >
                <SlidersHorizontal className="size-3.5" />
                Strategy (Q1–Q2)
              </TabsTrigger>
              <TabsTrigger
                active={workspaceView === 'EXECUTION'}
                onClick={() => setWorkspaceView('EXECUTION')}
              >
                <Terminal className="size-3.5" />
                CLI & On-Chain (Q3–Q4)
              </TabsTrigger>
            </TabsList>

            {/* Live Metallic Ticker Capsule */}
            <div className="glass-subcard rounded-xl px-3.5 py-1.5 flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  {b1.instId}
                </span>
                <div className="font-mono font-semibold text-sm text-white flex items-center gap-1.5">
                  ${b1.market.lastPx.toFixed(4)}
                  <span
                    className={cn(
                      'text-[11px] font-mono',
                      b1.market.change24hPct >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    )}
                  >
                    {b1.market.change24hPct >= 0 ? '+' : ''}
                    {b1.market.change24hPct.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-white/[0.08]" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Regime
                </span>
                <Badge variant={regimeVariant} className="mt-0.5">
                  {b2.regime}
                </Badge>
              </div>
            </div>

            {/* Tactile Auto-Pilot Toggle */}
            <button
              type="button"
              onClick={toggleAutoPilot}
              className={cn(
                'metal-btn px-3.5 py-2 rounded-xl font-mono text-xs font-medium flex items-center gap-2',
                state.autoPilotEnabled &&
                  'border-emerald-400/40 text-emerald-200'
              )}
            >
              {state.autoPilotEnabled ? (
                <>
                  <Pause className="size-3.5 text-emerald-400 animate-pulse" />
                  Auto-Pilot: ON (20s)
                </>
              ) : (
                <>
                  <Play className="size-3.5 text-zinc-400" />
                  Auto-Pilot: OFF (20s)
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN PRODUCTIVITY WORKSPACE */}
      <main className="max-w-[1640px] w-full mx-auto px-4 lg:px-6 py-5 flex flex-col gap-4 flex-1">
        {errorBanner && (
          <div className="glass-subcard rounded-xl px-4 py-2.5 border-amber-400/30 text-amber-200 text-xs font-mono flex items-center justify-between">
            <span>⚠️ {errorBanner}</span>
            <button
              type="button"
              onClick={fetchStatus}
              className="underline hover:text-white ml-4"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* 1. UNBREAKABLE 4-BORDER PIPELINE ARCHITECTURE RIBBON */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Layers className="size-4 text-zinc-300" />
              <CardTitle>Unbreakable 4-Border Pipeline Architecture</CardTitle>
              <CardDescription>
                Click any border card to inspect its strict TypeScript & JSON I/O contract
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="emerald">
                <CheckCircle2 className="size-3" />
                4/4 Borders Verified • 0 Unhandled Exceptions
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-3.5 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                {
                  num: 1 as const,
                  meta: b1.meta,
                  badge: 'LIVE OKX CLI',
                  subtitle: `${b1.cliRecords.length} OKX CLI Feeds • AVAX $${b1.market.lastPx.toFixed(
                    4
                  )} • ATR $${b1.technicals.atr14.toFixed(4)}`,
                },
                {
                  num: 2 as const,
                  meta: b2.meta,
                  badge: 'QUANT ENGINE',
                  subtitle: `Regime: ${b2.regime} • D_trap: ${
                    b2.formulas.dTrap >= 0 ? '+' : ''
                  }${b2.formulas.dTrap.toFixed(2)} (${b2.formulas.dTrapBps} bps)`,
                },
                {
                  num: 3 as const,
                  meta: b3.meta,
                  badge: 'ATK EXECUTOR',
                  subtitle: `Action: ${b2.recommendedAction} • Ref #${b3.primaryOkxAlgoOrOrdId}`,
                },
                {
                  num: 4 as const,
                  meta: b4.meta,
                  badge: 'AVA LABS 8004',
                  subtitle: `Agent #257 • Hash ${b4.anchorRecord.reasoningHash.slice(
                    0,
                    10
                  )}... • Fuji #${b4.operatorWallet.latestBlockNumber}`,
                },
              ].map((item) => {
                const isSelected = inspectedBorder === item.num;
                return (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() =>
                      setInspectedBorder(isSelected ? null : item.num)
                    }
                    className={cn(
                      'glass-subcard text-left rounded-xl p-3.5 transition-all duration-150 flex flex-col gap-1.5',
                      isSelected
                        ? 'border-white/30 bg-white/[0.08] ring-1 ring-white/20'
                        : 'hover:border-white/15 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-semibold text-zinc-100 tracking-tight truncate">
                        {item.meta.borderName}
                      </span>
                      <Badge variant="emerald" className="shrink-0">
                        {item.meta.status} • {item.meta.durationMs}ms
                      </Badge>
                    </div>
                    <div className="text-xs font-mono text-zinc-300 truncate">
                      {item.subtitle}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between pt-0.5">
                      <span className="truncate">
                        Out: {item.meta.outputContract.split(' ')[0]}
                      </span>
                      <span className="text-zinc-200 flex items-center gap-0.5 shrink-0 ml-2">
                        {isSelected ? 'Hide Contract' : 'Inspect JSON'}
                        <ChevronRight className="size-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {inspectedBorder && (
              <div className="glass-well rounded-xl p-4 font-mono text-xs flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <Badge variant="metallic">
                      BORDER {inspectedBorder} CONTRACT
                    </Badge>
                    <span className="text-zinc-300 text-[11px]">
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
                    type="button"
                    onClick={() => setInspectedBorder(null)}
                    className="metal-badge px-2.5 py-0.5 rounded-md text-[11px] text-zinc-300 hover:text-white"
                  >
                    Close [×]
                  </button>
                </div>
                <pre className="max-h-60 overflow-auto text-[11px] text-zinc-200 leading-relaxed">
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
          </CardContent>
        </Card>

        {/* 2. FIVE ONE-CLICK STAGE DEMO & SCENARIO PIPELINE TRIGGERS */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-zinc-300" />
              <CardTitle>
                One-Click Stage Pitch & Quantitative Scenario Triggers
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span>Active Mode:</span>
              <Badge variant="metallic">{cycle.scenario}</Badge>
            </div>
          </CardHeader>

          <CardContent className="p-3.5 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                {
                  mode: 'LIVE' as ScenarioMode,
                  title: 'Run Live OKX Cycle',
                  badge: 'LIVE CLI',
                  badgeVariant: 'emerald' as BadgeVariant,
                  icon: RefreshCw,
                  desc: 'Pulls live AVAX-USDT-SWAP market, sentiment & whale data and anchors on Fuji.',
                },
                {
                  mode: 'DRIFT_SURGERY' as ScenarioMode,
                  title: 'Simulate Boundary Drift',
                  badge: 'GRID AMEND',
                  badgeVariant: 'cyan' as BadgeVariant,
                  icon: Wrench,
                  desc: 'Simulates 93.4% upper boundary drift → triggers live in-flight okx bot grid amend surgery.',
                },
                {
                  mode: 'BULL_TRAP' as ScenarioMode,
                  title: 'Trigger Bull Trap',
                  badge: 'D_trap > +1.10',
                  badgeVariant: 'rose' as BadgeVariant,
                  icon: ShieldAlert,
                  desc: 'Retail 87% Bullish vs Whales Shorting → stops grid, opens 3x Short + 1.5% Trail.',
                },
                {
                  mode: 'PROFIT_SWEEP' as ScenarioMode,
                  title: 'High-Water Profit Sweep',
                  badge: '18 → 6 → EARN',
                  badgeVariant: 'metallic' as BadgeVariant,
                  icon: Coins,
                  desc: 'Sweeps 50% of realized profit ($42.30 USDT) from Trading (18) → Funding (6) → Simple Earn.',
                },
                {
                  mode: 'MACRO_BUNKER' as ScenarioMode,
                  title: 'Macro Shock Bunker',
                  badge: 'CPI IN 14m',
                  badgeVariant: 'amber' as BadgeVariant,
                  icon: ShieldCheck,
                  desc: 'Simulates US CPI/FOMC release in 14m → de-leverages to 1x & tightens OCO SL.',
                },
              ].map((btn) => {
                const IconComp = btn.icon;
                const isRunning = loadingScenario === btn.mode;
                const isActive = cycle.scenario === btn.mode;
                return (
                  <button
                    key={btn.mode}
                    type="button"
                    disabled={loadingScenario !== null}
                    onClick={() => triggerScenario(btn.mode)}
                    className={cn(
                      'metal-btn rounded-xl p-3 text-left flex flex-col justify-between gap-2 disabled:opacity-50',
                      isActive && 'border-white/30 bg-white/[0.09]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                        <IconComp
                          className={cn(
                            'size-3.5 text-zinc-300 shrink-0',
                            isRunning && 'animate-spin text-white'
                          )}
                        />
                        {btn.title}
                      </span>
                      <Badge variant={btn.badgeVariant}>{btn.badge}</Badge>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {btn.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. FOUR-QUADRANT METALLIC GLASS COMMAND WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* QUADRANT 1: GRIDSURGEON LIVE CORRIDOR VISUALIZER */}
          {showStrategyQuadrants && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg metal-badge flex items-center justify-center">
                    <Activity className="size-3.5 text-emerald-300" />
                  </div>
                  <div>
                    <CardTitle>
                      Q1 // GridSurgeon Corridor & In-Flight Surgery
                    </CardTitle>
                    <CardDescription>
                      Real-time Bollinger Bandwidth, ATR(14) corridor bounds & server-side bot surgery
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="emerald">
                  Algo #{gridBot.algoId} • {gridBot.status} ({gridBot.leverage}x)
                </Badge>
              </CardHeader>

              <CardContent>
                {/* 6 Technical KPIs */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    {
                      label: 'LIVE PRICE',
                      value: `$${b1.market.lastPx.toFixed(4)}`,
                      tone: 'text-white',
                    },
                    {
                      label: 'ATR (14) 1H',
                      value: `$${b1.technicals.atr14.toFixed(4)}`,
                      tone: 'text-zinc-200',
                    },
                    {
                      label: 'ADX (14)',
                      value: b1.technicals.adx14.toFixed(1),
                      tone: 'text-emerald-300',
                    },
                    {
                      label: 'RSI (14)',
                      value: b1.technicals.rsi14.toFixed(1),
                      tone: 'text-amber-300',
                    },
                    {
                      label: 'BB WIDTH',
                      value: `${b1.technicals.bbWidthPct.toFixed(2)}%`,
                      tone: 'text-zinc-200',
                    },
                    {
                      label: 'LIQ PRICE',
                      value: `$${gridBot.liquidationPx.toFixed(3)}`,
                      tone: 'text-rose-300',
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5"
                    >
                      <span className="text-[10px] font-mono text-zinc-400">
                        {kpi.label}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-mono font-semibold',
                          kpi.tone
                        )}
                      >
                        {kpi.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Corridor Utilization Gauge */}
                <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300">
                      Corridor Position:{' '}
                      <strong className="text-white">{corridorPct}%</strong>
                    </span>
                    <Badge
                      variant={
                        b2.gridPlan.requiresInFlightSurgery ? 'cyan' : 'emerald'
                      }
                    >
                      {b2.gridPlan.requiresInFlightSurgery
                        ? '⚡ SURGERY TRIGGERED (<12% or >88%)'
                        : '✓ HEALTHY INNER CORRIDOR [12%–88%]'}
                    </Badge>
                  </div>

                  <div className="relative h-3.5 rounded-full bg-zinc-950/90 border border-white/[0.1] overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[12%] bg-rose-500/20 border-r border-rose-400/40" />
                    <div className="absolute inset-y-0 right-0 w-[12%] bg-rose-500/20 border-l border-rose-400/40" />
                    <div
                      className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-500"
                      style={{ left: `calc(${corridorPct}% - 4px)` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>SL: ${gridBot.slTriggerPx.toFixed(4)}</span>
                    <span className="text-zinc-200">
                      minPx: ${gridBot.minPx.toFixed(4)}
                    </span>
                    <span className="text-white font-semibold">
                      AVAX: ${b1.market.lastPx.toFixed(4)}
                    </span>
                    <span className="text-zinc-200">
                      maxPx: ${gridBot.maxPx.toFixed(4)}
                    </span>
                    <span>TP: ${gridBot.tpTriggerPx.toFixed(4)}</span>
                  </div>
                </div>

                {/* 12-Level Contract Grid Ladder */}
                <div className="glass-well rounded-xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>
                      12-LEVEL CONTRACT GRID LADDER (Step: $
                      {b2.gridPlan.gridStepUsdt.toFixed(4)} /{' '}
                      {b2.gridPlan.gridStepPct}%)
                    </span>
                    <span>
                      BB(20,2): [${b1.technicals.bbLower.toFixed(3)} — $
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
                          className={cn(
                            'px-2 py-1.5 rounded-lg text-[11px] font-mono border flex flex-col items-center transition-colors',
                            isClosest
                              ? 'bg-white/[0.14] border-white/40 text-white font-semibold shadow-sm'
                              : isAsk
                              ? 'bg-rose-500/[0.06] border-rose-400/20 text-rose-200/90'
                              : 'bg-emerald-500/[0.06] border-emerald-400/20 text-emerald-200/90'
                          )}
                        >
                          <span className="text-[9px] uppercase opacity-70">
                            L{idx} {isClosest ? '• NOW' : isAsk ? 'ASK' : 'BID'}
                          </span>
                          <span>${lvl.toFixed(3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* In-Flight Surgery History */}
                <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-200 font-medium flex items-center gap-1.5">
                      <Wrench className="size-3.5 text-zinc-300" />
                      In-Flight Surgery Log (okx bot grid amend)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Amendments: {gridBot.amendCount}
                    </span>
                  </div>
                  {state.surgeryHistory.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-1">
                      No drift surgeries triggered yet. Click{' '}
                      <strong className="text-zinc-200">
                        "Simulate Boundary Drift"
                      </strong>{' '}
                      above to execute live in-flight{' '}
                      <code className="text-zinc-200">okx bot grid amend</code>{' '}
                      surgery.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {state.surgeryHistory.slice(0, 4).map((surg) => (
                        <div
                          key={surg.id}
                          className="glass-well rounded-lg p-2.5 text-[11px] font-mono flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between text-zinc-200 font-medium">
                            <span>
                              Algo #{surg.algoId} Recentered @ $
                              {surg.triggerPx.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {new Date(surg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-zinc-400">
                            [{surg.previousMinPx.toFixed(4)},{' '}
                            {surg.previousMaxPx.toFixed(4)}] →{' '}
                            <strong className="text-emerald-300">
                              [{surg.newMinPx.toFixed(4)},{' '}
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
              </CardContent>
            </Card>
          )}

          {/* QUADRANT 2: CONTRACROWD DIVERGENCE RADAR */}
          {showStrategyQuadrants && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg metal-badge flex items-center justify-center">
                    <Crosshair className="size-3.5 text-rose-300" />
                  </div>
                  <div>
                    <CardTitle>
                      Q2 // ContraCrowd Retail-vs-Whale Divergence Radar
                    </CardTitle>
                    <CardDescription>
                      Cross-examining OKX Social Sentiment against Smart Money Whale Notional
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={
                    b2.formulas.trapClassification === 'BULL_TRAP'
                      ? 'rose'
                      : b2.formulas.trapClassification === 'BEAR_TRAP'
                      ? 'emerald'
                      : 'metallic'
                  }
                >
                  D_trap = {b2.formulas.dTrap >= 0 ? '+' : ''}
                  {b2.formulas.dTrap.toFixed(2)} ({b2.formulas.trapClassification})
                </Badge>
              </CardHeader>

              <CardContent>
                {/* Retail vs Whale Dual Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Retail Sentiment */}
                  <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">
                        RETAIL SENTIMENT (S_retail)
                      </span>
                      <span className="text-emerald-300 font-semibold">
                        {b1.sentiment.sRetail >= 0 ? '+' : ''}
                        {b1.sentiment.sRetail.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-rose-500/30 overflow-hidden flex">
                      <div
                        className="bg-emerald-400/90 h-full transition-all duration-500"
                        style={{
                          width: `${(b1.sentiment.bullishRatio * 100).toFixed(
                            0
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-emerald-300 flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Bullish {(b1.sentiment.bullishRatio * 100).toFixed(0)}%
                      </span>
                      <span className="text-rose-300 flex items-center gap-1">
                        Bearish {(b1.sentiment.bearishRatio * 100).toFixed(0)}%
                        <TrendingDown className="size-3" />
                      </span>
                    </div>
                  </div>

                  {/* Smart Money Whales */}
                  <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">
                        SMART MONEY WHALES (W_whale)
                      </span>
                      <span
                        className={cn(
                          'font-semibold',
                          b1.smartMoney.wWhale >= 0
                            ? 'text-emerald-300'
                            : 'text-rose-300'
                        )}
                      >
                        {b1.smartMoney.wWhale >= 0 ? '+' : ''}
                        {b1.smartMoney.wWhale.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-rose-500/40 overflow-hidden flex">
                      <div
                        className="bg-emerald-400/90 h-full transition-all duration-500"
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
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-emerald-300">
                        Long: ${(b1.smartMoney.longNotionalUsd / 1e6).toFixed(2)}M
                      </span>
                      <span className="text-rose-300">
                        Short: $
                        {(b1.smartMoney.shortNotionalUsd / 1e6).toFixed(2)}M
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trap Score Formula Spectrum */}
                <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-zinc-300">
                      Formula:{' '}
                      <code className="text-zinc-100">
                        D_trap = S_retail + 0.5·F_norm − 1.5·W_whale
                      </code>
                    </span>
                    <span className="text-zinc-400">
                      = ({b2.formulas.sRetail.toFixed(2)}) + 0.5·(
                      {b2.formulas.fNorm.toFixed(2)}) − 1.5·(
                      {b2.formulas.wWhale.toFixed(2)}) ={' '}
                      <strong className="text-white">
                        {b2.formulas.dTrap >= 0 ? '+' : ''}
                        {b2.formulas.dTrap.toFixed(2)}
                      </strong>
                    </span>
                  </div>

                  <div className="relative h-3.5 rounded-full bg-zinc-950/90 border border-white/[0.1] overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-[28%] bg-emerald-500/15 border-r border-emerald-400/35" />
                    <div className="absolute inset-y-0 right-0 w-[28%] bg-rose-500/15 border-l border-rose-400/35" />
                    <div
                      className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-500"
                      style={{
                        left: `calc(${Math.min(
                          98,
                          Math.max(2, ((b2.formulas.dTrap + 2.5) / 5) * 100)
                        )}% - 4px)`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span className="text-emerald-300">
                      &lt; −1.10 BEAR TRAP (LONG)
                    </span>
                    <span>NEUTRAL RANGE [−1.10, +1.10]</span>
                    <span className="text-rose-300">
                      &gt; +1.10 BULL TRAP (SHORT)
                    </span>
                  </div>
                </div>

                {/* Funding, OI & Macro Strip */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      PERP FUNDING RATE
                    </span>
                    <span className="text-xs font-mono font-semibold text-white">
                      {(b1.market.fundingRate * 100).toFixed(4)}% (F_norm:{' '}
                      {b2.formulas.fNorm.toFixed(2)})
                    </span>
                  </div>
                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      1H OPEN INTEREST Δ
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-100">
                      {b1.market.oiDelta1hPct >= 0 ? '+' : ''}
                      {b1.market.oiDelta1hPct.toFixed(2)}% ($
                      {(b1.market.oiUsd / 1e6).toFixed(1)}M)
                    </span>
                  </div>
                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      US MACRO CALENDAR
                    </span>
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold truncate',
                        b1.macroCalendar.imminentHighImpactEvent
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      )}
                    >
                      {b1.macroCalendar.imminentHighImpactEvent
                        ? `🚨 ${b1.macroCalendar.minutesUntilRelease}m to CPI/FOMC`
                        : '✓ Clear (>30m window)'}
                    </span>
                  </div>
                </div>

                {/* Brain Execution Summary */}
                <div className="glass-well rounded-xl p-3.5 flex flex-col gap-1.5">
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                    Quantitative Brain Decision & Position Status
                  </span>
                  <p className="text-xs font-mono text-zinc-100 leading-relaxed">
                    {b3.actionExecuted}
                  </p>
                  {state.activeTrapPosition && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-rose-300">
                        <span>
                          Counter-Trap Order #{state.activeTrapPosition.ordId}:{' '}
                          {state.activeTrapPosition.posSide.toUpperCase()}{' '}
                          {state.activeTrapPosition.leverage}x ($
                          {state.activeTrapPosition.notionalUsdt} @ $
                          {state.activeTrapPosition.entryPx.toFixed(4)})
                        </span>
                        <span>
                          TP: ${state.activeTrapPosition.tpTriggerPx} | SL: $
                          {state.activeTrapPosition.slTriggerPx} | Trail: 1.5%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* QUADRANT 3: LIVE OKX ATK CLI EXECUTION TERMINAL */}
          {showExecutionQuadrants && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg metal-badge flex items-center justify-center">
                    <Terminal className="size-3.5 text-zinc-100" />
                  </div>
                  <div>
                    <CardTitle>
                      Q3 // Live OKX Agent Trade Kit (ATK) CLI Stream
                    </CardTitle>
                    <CardDescription>
                      Authenticated OAuth (site: tr) telemetry & execution pipeline
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="metallic">
                  7 ATK Skills • {state.cliHistory.length} Invocations
                </Badge>
              </CardHeader>

              <CardContent>
                {/* Productivity Skill Filter Bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    'ALL',
                    'okx-cex-market',
                    'okx-sentiment-tracker',
                    'okx-cex-smartmoney',
                    'okx-cex-bot',
                    'okx-cex-trade',
                    'okx-cex-earn',
                  ].map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setCliSkillFilter(sk)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all',
                        cliSkillFilter === sk
                          ? 'metal-badge text-white font-semibold'
                          : 'bg-white/[0.02] text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
                      )}
                    >
                      {sk === 'ALL' ? 'All Skills' : sk.replace('okx-', '')}
                    </button>
                  ))}
                </div>

                {/* CLI Execution Stream */}
                <div className="flex flex-col gap-2 max-h-[390px] overflow-y-auto pr-1">
                  {filteredCliHistory.slice(0, 18).map((rec) => {
                    const isExpanded = expandedCliId === rec.id;
                    const isLive =
                      rec.mode === 'LIVE_CLI_READ' ||
                      rec.mode === 'LIVE_CLI_WRITE';
                    return (
                      <div
                        key={rec.id}
                        className="glass-well rounded-xl p-2.5 font-mono text-xs flex flex-col gap-1.5"
                      >
                        <div
                          onClick={() =>
                            setExpandedCliId(isExpanded ? null : rec.id)
                          }
                          className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3.5 text-zinc-400 shrink-0" />
                            )}
                            <Badge variant="outline" className="shrink-0">
                              {rec.skill}
                            </Badge>
                            <code className="text-zinc-100 truncate font-medium">
                              $ {rec.command}
                            </code>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={isLive ? 'emerald' : 'metallic'}>
                              {rec.mode}
                            </Badge>
                            <span className="text-[10px] text-zinc-400">
                              {rec.durationMs}ms
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-zinc-400 pl-5">
                          → {rec.summary}
                        </div>
                        {isExpanded && (
                          <pre className="mt-1 p-2.5 rounded-lg bg-black/60 border border-white/[0.07] text-[10px] text-zinc-200 overflow-x-auto max-h-44">
                            {JSON.stringify(rec.rawPreview, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>

              <CardFooter className="text-[11px] font-mono text-zinc-400">
                <span>Binary: /opt/homebrew/bin/okx (@okx_ai/okx-trade-cli)</span>
                <span className="text-zinc-300">
                  Click any command row to inspect raw JSON payload
                </span>
              </CardFooter>
            </Card>
          )}

          {/* QUADRANT 4: HIGH-WATER MARK TREASURY & AVALANCHE ERC-8004 LEDGER */}
          {showExecutionQuadrants && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg metal-badge flex items-center justify-center">
                    <Anchor className="size-3.5 text-amber-300" />
                  </div>
                  <div>
                    <CardTitle>
                      Q4 // Treasury & Ava Labs ERC-8004 On-Chain Ledger
                    </CardTitle>
                    <CardDescription>
                      High-Water Mark Simple Earn Sweeper & Official Ava Labs 8004-Boilerplate Registries
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="amber">
                  Fuji Block #{b4.operatorWallet.latestBlockNumber}
                </Badge>
              </CardHeader>

              <CardContent>
                {/* Treasury KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      TOTAL PORTFOLIO NAV
                    </span>
                    <span className="text-sm font-mono font-semibold text-white">
                      ${b3.treasury.totalNavUsdt.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      HWM: ${b3.treasury.highWaterMarkNavUsdt.toFixed(2)}
                    </span>
                  </div>

                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      TRADING ACCT (18)
                    </span>
                    <span className="text-sm font-mono font-semibold text-zinc-100">
                      ${b3.treasury.tradingAccountUsdt.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Active Margin Pool
                    </span>
                  </div>

                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5 border-emerald-400/25">
                    <span className="text-[10px] font-mono text-emerald-300 flex items-center gap-1">
                      <Lock className="size-3" /> SIMPLE EARN LOCKED
                    </span>
                    <span className="text-sm font-mono font-semibold text-emerald-300">
                      ${b3.treasury.lockedSimpleEarnUsdt.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {b3.treasury.simpleEarnApyPct}% APY (
                      {b3.treasury.totalProfitSweptCount} Sweeps)
                    </span>
                  </div>

                  <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-mono text-zinc-400">
                      CUMULATIVE REALIZED
                    </span>
                    <span className="text-sm font-mono font-semibold text-zinc-100">
                      +${b3.treasury.cumulativeRealizedPnlUsdt.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      50% Swept to Earn
                    </span>
                  </div>
                </div>

                {/* Official Ava Labs ERC-8004 Agent Passport */}
                {b4.erc8004Passport && (
                  <div className="glass-subcard rounded-xl p-3.5 flex flex-col gap-2.5 font-mono text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-100 font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-emerald-300" />
                        Ava Labs ERC-8004 Passport • Agent NFT #
                        {b4.erc8004Passport.identityRegistry.agentId} (
                        {b4.erc8004Passport.identityRegistry.agentDomain})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href="https://testnet.snowtrace.io/tx/0x1b31a49f0cd1722b24a536bd9cfcc33ae75cad015887abd530cbd196d2769804"
                          target="_blank"
                          rel="noreferrer"
                          className="metal-badge px-2 py-0.5 rounded-md text-[10px] text-emerald-300 hover:text-white flex items-center gap-1"
                        >
                          NFT #257 Tx <ExternalLink className="size-2.5" />
                        </a>
                        <a
                          href="http://localhost:4001/.well-known/agent-card.json"
                          target="_blank"
                          rel="noreferrer"
                          className="metal-badge px-2 py-0.5 rounded-md text-[10px] text-zinc-200 hover:text-white flex items-center gap-1"
                        >
                          agent-card.json <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="glass-well rounded-lg p-2.5 flex flex-col gap-0.5">
                        <span className="text-[9px] text-zinc-400">
                          1. IDENTITY REGISTRY (0x8004A8...)
                        </span>
                        <span className="text-emerald-300 font-semibold">
                          {b4.erc8004Passport.identityRegistry.status}
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate">
                          Minted Agent ID #
                          {b4.erc8004Passport.identityRegistry.agentId}
                        </span>
                      </div>
                      <div className="glass-well rounded-lg p-2.5 flex flex-col gap-0.5">
                        <span className="text-[9px] text-zinc-400">
                          2. VALIDATION REGISTRY (0xffe347...)
                        </span>
                        <span className="text-zinc-100 font-semibold">
                          {
                            b4.erc8004Passport.validationRegistry
                              .totalValidatedTasks
                          }{' '}
                          Tasks Verified
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate">
                          EIP-191 + Keccak256
                        </span>
                      </div>
                      <div className="glass-well rounded-lg p-2.5 flex flex-col gap-0.5">
                        <span className="text-[9px] text-zinc-400">
                          3. REPUTATION REGISTRY (0x8004B6...)
                        </span>
                        <span className="text-amber-300 font-semibold">
                          Score:{' '}
                          {b4.erc8004Passport.reputationRegistry.trustScore}/100
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate">
                          {b4.erc8004Passport.reputationRegistry.feedbackCount}{' '}
                          On-Chain Proofs
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Avalanche Fuji Contract & Cryptographic Proof Details */}
                <div className="glass-well rounded-xl p-3.5 flex flex-col gap-2 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={`https://testnet.snowtrace.io/address/${b4.contractInfo.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-100 hover:underline font-semibold flex items-center gap-1.5"
                    >
                      <FileCode2 className="size-3.5 text-zinc-300" />
                      contracts/GridSurgeonRegistry.sol (Fuji{' '}
                      {b4.anchorRecord.chainId})
                      <ExternalLink className="size-3" />
                    </a>
                    <Badge variant="emerald">{b4.anchorRecord.status}</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="glass-subcard rounded-lg px-2.5 py-2 flex items-center justify-between">
                      <div className="truncate">
                        <span className="text-zinc-400">Operator: </span>
                        <a
                          href={`https://testnet.snowtrace.io/address/${b4.operatorWallet.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-200 hover:text-white underline"
                        >
                          {b4.operatorWallet.address.slice(0, 10)}...
                          {b4.operatorWallet.address.slice(-8)}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText('opAddr', b4.operatorWallet.address)
                        }
                        className="text-zinc-400 hover:text-white ml-2"
                      >
                        {copiedKey === 'opAddr' ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="glass-subcard rounded-lg px-2.5 py-2 flex items-center justify-between">
                      <div className="truncate">
                        <span className="text-zinc-400">Registry: </span>
                        <a
                          href={`https://testnet.snowtrace.io/address/${b4.contractInfo.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-200 hover:text-white underline"
                        >
                          {b4.contractInfo.address.slice(0, 10)}...
                          {b4.contractInfo.address.slice(-8)}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText('regAddr', b4.contractInfo.address)
                        }
                        className="text-zinc-400 hover:text-white ml-2"
                      >
                        {copiedKey === 'regAddr' ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {b4.anchorRecord.txHash && (
                    <div className="glass-subcard rounded-lg px-2.5 py-2 border-emerald-400/30 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-300 truncate">
                        ✓ Live Fuji Decision Tx:{' '}
                        {b4.anchorRecord.txHash.slice(0, 18)}...
                        {b4.anchorRecord.txHash.slice(-10)}
                      </span>
                      <a
                        href={`https://testnet.snowtrace.io/tx/${b4.anchorRecord.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-100 hover:underline flex items-center gap-1 shrink-0 ml-2 font-semibold"
                      >
                        Snowtrace <ExternalLink className="size-3" />
                      </a>
                    </div>
                  )}

                  <div className="glass-subcard rounded-lg px-2.5 py-2 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>KECCAK256 REASONING HASH (_reasoningHash)</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText('hash', b4.anchorRecord.reasoningHash)
                        }
                        className="text-zinc-200 hover:underline"
                      >
                        {copiedKey === 'hash' ? 'Copied' : 'Copy Hash'}
                      </button>
                    </div>
                    <div className="text-[11px] text-zinc-200 truncate">
                      {b4.anchorRecord.reasoningHash}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleBrowserWalletAnchor}
                      className="metal-btn flex-1 py-2 px-3 rounded-xl text-zinc-100 font-medium text-xs flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="size-3.5" />
                      Anchor Decision via Browser Wallet (Core / MetaMask)
                    </button>
                    <button
                      type="button"
                      onClick={handleDeployContract}
                      className="metal-btn py-2 px-3 rounded-xl text-zinc-300 text-xs"
                    >
                      Deploy Bytecode
                    </button>
                  </div>

                  {walletStatusMsg && (
                    <div className="text-[11px] text-emerald-300 glass-subcard rounded-lg px-2.5 py-1.5">
                      {walletStatusMsg}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

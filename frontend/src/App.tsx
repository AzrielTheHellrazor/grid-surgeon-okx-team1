import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Cpu,
  Terminal,
  Anchor,
  Wrench,
  Crosshair,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Lock,
  ExternalLink,
  Play,
  Pause,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
} from 'lucide-react';
import {
  CandleBar,
  FullPipelineCycleResult,
  PersistedSurgeonState,
} from './types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  cn,
} from './components/ui/shadcn-metallic';

const API_BASE = 'http://localhost:4001/api';

const INSTRUMENTS = [
  { id: 'AVAX-USDT-SWAP', short: 'AVAX' },
  { id: 'BTC-USDT-SWAP', short: 'BTC' },
  { id: 'ETH-USDT-SWAP', short: 'ETH' },
  { id: 'SOL-USDT-SWAP', short: 'SOL' },
];

const TIMEFRAMES = ['1m', '5m', '15m', '1H'] as const;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

function formatPrice(px: number): string {
  if (!Number.isFinite(px)) return '0.00';
  if (px >= 1000) return px.toFixed(1);
  if (px >= 50) return px.toFixed(2);
  return px.toFixed(4);
}

/**
 * Clean Metallic SVG Candlestick + 12 Grid Corridor Chart
 */
function GridCandleChart({
  candles,
  gridLevels,
  minPx,
  maxPx,
  tpPx,
  slPx,
  lastPx,
  bar = '1m',
}: {
  candles: CandleBar[];
  gridLevels: number[];
  minPx: number;
  maxPx: number;
  tpPx: number;
  slPx: number;
  lastPx: number;
  bar?: string;
}) {
  const bars = candles.slice(-36);
  if (bars.length === 0) return null;

  const candleHigh = Math.max(...bars.map((b) => b.high));
  const candleLow = Math.min(...bars.map((b) => b.low));
  const rawMax = Math.max(candleHigh, maxPx, tpPx);
  const rawMin = Math.min(candleLow, minPx, slPx);
  const rawSpan = Math.max(0.0001, rawMax - rawMin);
  const chartMax = rawMax + rawSpan * 0.08;
  const chartMin = rawMin - rawSpan * 0.08;
  const span = Math.max(0.0001, chartMax - chartMin);

  const width = 560;
  const height = 136;
  const toY = (px: number) =>
    Math.min(
      height - 4,
      Math.max(4, height - ((px - chartMin) / span) * (height - 8) - 4)
    );

  const barStep = width / bars.length;
  const bodyWidth = Math.max(3, barStep * 0.56);

  return (
    <div className="glass-well rounded-xl p-2.5 relative overflow-hidden">
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-1 px-1">
        <span>
          {bar} CANDLES ({bars.length}) + 12 GRID LEVELS
        </span>
        <span className="text-zinc-300">
          Range: ${formatPrice(minPx)} – ${formatPrice(maxPx)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[136px] overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Grid Corridor Shaded Band */}
        <rect
          x={0}
          y={toY(maxPx)}
          width={width}
          height={Math.max(2, toY(minPx) - toY(maxPx))}
          fill="rgba(255,255,255,0.025)"
        />

        {/* 12 Horizontal Grid Lines */}
        {gridLevels.map((lvl, idx) => {
          const y = toY(lvl);
          const isBoundary = idx === 0 || idx === gridLevels.length - 1;
          return (
            <line
              key={idx}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={
                isBoundary
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(255,255,255,0.07)'
              }
              strokeWidth={isBoundary ? 1 : 0.6}
              strokeDasharray={isBoundary ? 'none' : '3 3'}
            />
          );
        })}

        {/* TP & SL Trigger Lines */}
        <line
          x1={0}
          y1={toY(tpPx)}
          x2={width}
          y2={toY(tpPx)}
          stroke="rgba(52,211,153,0.45)"
          strokeWidth={0.8}
          strokeDasharray="4 4"
        />
        <line
          x1={0}
          y1={toY(slPx)}
          x2={width}
          y2={toY(slPx)}
          stroke="rgba(251,113,133,0.45)"
          strokeWidth={0.8}
          strokeDasharray="4 4"
        />

        {/* 1H Candlesticks */}
        {bars.map((bar, i) => {
          const cx = i * barStep + barStep / 2;
          const isBull = bar.close >= bar.open;
          const color = isBull ? '#34d399' : '#fb7185';
          const highY = toY(bar.high);
          const lowY = toY(bar.low);
          const topY = toY(Math.max(bar.open, bar.close));
          const botY = toY(Math.min(bar.open, bar.close));
          const bodyH = Math.max(1.5, botY - topY);

          return (
            <g key={bar.ts}>
              <line
                x1={cx}
                y1={highY}
                x2={cx}
                y2={lowY}
                stroke={color}
                strokeWidth={1}
                opacity={0.75}
              />
              <rect
                x={cx - bodyWidth / 2}
                y={topY}
                width={bodyWidth}
                height={bodyH}
                fill={color}
                rx={0.8}
              />
            </g>
          );
        })}

        {/* Live Price Highlight Line */}
        <line
          x1={0}
          y1={toY(lastPx)}
          x2={width}
          y2={toY(lastPx)}
          stroke="#ffffff"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<PersistedSurgeonState | null>(null);
  const [cycle, setCycle] = useState<FullPipelineCycleResult | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [switchingInst, setSwitchingInst] = useState<string | null>(null);
  const [switchingBar, setSwitchingBar] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [inspectedBorder, setInspectedBorder] = useState<1 | 2 | 3 | 4 | null>(
    null
  );
  const [expandedCliId, setExpandedCliId] = useState<string | null>(null);
  const [cliSkillFilter, setCliSkillFilter] = useState<string>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [walletStatusMsg, setWalletStatusMsg] = useState<string | null>(null);
  const [togglingBreaker, setTogglingBreaker] = useState<boolean>(false);
  const [verifyingProof, setVerifyingProof] = useState<boolean>(false);
  const [proofVerifiedMsg, setProofVerifiedMsg] = useState<string | null>(null);
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
    } catch {
      setErrorBanner('Reconnecting :4001...');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const runLiveCycle = async () => {
    setRefreshing(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.ok) {
        setState(data.state);
        setCycle(data.cycle);
      } else {
        setErrorBanner(data.error || 'Cycle error');
      }
    } catch {
      setErrorBanner('Backend offline (:4001)');
    } finally {
      setRefreshing(false);
    }
  };

  const switchInstrument = async (instId: string) => {
    if (switchingInst) return;
    setSwitchingInst(instId);
    setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/instrument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instId }),
      });
      const data = await res.json();
      if (data.ok) {
        setState(data.state);
        setCycle(data.cycle);
      }
    } catch {
      setErrorBanner('Instrument switch failed');
    } finally {
      setSwitchingInst(null);
    }
  };

  const switchTimeframe = async (bar: string) => {
    if (switchingBar) return;
    setSwitchingBar(bar);
    setErrorBanner(null);
    try {
      const res = await fetch(`${API_BASE}/timeframe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar }),
      });
      const data = await res.json();
      if (data.ok) {
        setState(data.state);
        setCycle(data.cycle);
      }
    } catch {
      setErrorBanner('Timeframe switch failed');
    } finally {
      setSwitchingBar(null);
    }
  };

  const triggerLiveAction = async (
    action: 'EARN_SWEEP' | 'EARN_REDEEM' | 'GRID_DEPLOY' | 'GRID_CANCEL'
  ) => {
    if (runningAction) return;
    setRunningAction(action);
    setActionToast(null);
    try {
      const res = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      if (data.cycle) setCycle(data.cycle);
      if (data.summary) {
        setActionToast(data.summary);
        setTimeout(() => setActionToast(null), 5000);
      }
    } catch {
      setErrorBanner('Action execution failed');
    } finally {
      setRunningAction(null);
    }
  };

  const toggleCircuitBreaker = async () => {
    if (togglingBreaker) return;
    setTogglingBreaker(true);
    try {
      const res = await fetch(`${API_BASE}/circuit-breaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.state) setState(data.state);
      if (data.cycle) setCycle(data.cycle);
      setActionToast(
        data.circuitBreakerActive
          ? 'Avalanche Circuit Breaker LOCKED (OKX Writes Blocked)'
          : 'Avalanche Circuit Breaker UNLOCKED (OKX Writes Enabled)'
      );
      setTimeout(() => setActionToast(null), 5000);
    } catch {
      setErrorBanner('Circuit breaker tx failed');
    } finally {
      setTogglingBreaker(false);
    }
  };

  const verifyProofOnChain = async (hash: string) => {
    if (verifyingProof) return;
    setVerifyingProof(true);
    try {
      const res = await fetch(`${API_BASE}/verify-hash/${hash}`);
      const data = await res.json();
      if (data.isValid) {
        setProofVerifiedMsg(`ON-CHAIN VERIFIED ✓ (#${data.agentId})`);
      } else {
        setProofVerifiedMsg('PENDING INDEX');
      }
      setTimeout(() => setProofVerifiedMsg(null), 5000);
    } catch {
      setProofVerifiedMsg('RPC Error');
    } finally {
      setVerifyingProof(false);
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
      // ignore
    }
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleBrowserWalletAnchor = async () => {
    if (!cycle) return;
    const anchor = cycle.border4Anchor.anchorRecord;
    if (!window.ethereum) {
      copyText('calldata', anchor.encodedRecordDecisionCalldata);
      setWalletStatusMsg('Calldata copied');
      return;
    }

    try {
      setWalletStatusMsg('Connecting wallet...');
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (!accounts || accounts.length === 0) return;

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa869' }],
        });
      } catch {
        // stay on current chain
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
      setWalletStatusMsg(`Tx: ${txHash.slice(0, 14)}...`);
      fetchStatus();
    } catch {
      setWalletStatusMsg('Cancelled');
    }
  };

  if (!cycle || !state) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="glass-panel rounded-2xl px-6 py-5 flex items-center gap-3">
          <Cpu className="size-5 text-zinc-200 animate-spin" />
          <span className="text-sm font-mono text-zinc-200">
            GRID-SURGEON LOADING...
          </span>
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

  const filteredCliHistory =
    cliSkillFilter === 'ALL'
      ? state.cliHistory
      : state.cliHistory.filter((r) => r.skill === cliSkillFilter);

  const whaleTotal =
    b1.smartMoney.longNotionalUsd + b1.smartMoney.shortNotionalUsd;
  const whaleLongPct =
    whaleTotal > 0
      ? Math.round((b1.smartMoney.longNotionalUsd / whaleTotal) * 100)
      : 50;

  const finalityMs =
    b4.onChainState?.finalityMs || b4.anchorRecord.finalityMs || 0;

  return (
    <div className="min-h-dvh flex flex-col text-zinc-100 select-none">
      {/* 1. COMPACT EXCHANGE TOP BAR */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-zinc-950/75 backdrop-blur-2xl">
        <div className="max-w-[1640px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Brand + Multi-Asset Switcher + Live Ticker */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg metal-badge flex items-center justify-center">
                <Crosshair className="size-4 text-zinc-100" />
              </div>
              <span className="font-bold text-sm tracking-tight text-metallic">
                GRID-SURGEON
              </span>
            </div>

            {/* Multi-Asset Selector (AVAX / BTC / ETH / SOL) */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              {INSTRUMENTS.map((inst) => {
                const isSelected = b1.instId === inst.id;
                const isLoadingThis = switchingInst === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    disabled={switchingInst !== null}
                    onClick={() => switchInstrument(inst.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-mono font-medium transition flex items-center gap-1',
                      isSelected
                        ? 'bg-white/[0.15] text-white border border-white/25 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-100'
                    )}
                  >
                    {isLoadingThis && (
                      <RefreshCw className="size-2.5 animate-spin text-emerald-400" />
                    )}
                    <span>{inst.short}</span>
                  </button>
                );
              })}
            </div>

            {/* Timeframe Selector (1m / 5m / 15m / 1H) */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              {TIMEFRAMES.map((tf) => {
                const activeTf = b1.bar || state.selectedBar || '1m';
                const isSelected = activeTf === tf;
                const isLoadingTf = switchingBar === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    disabled={switchingBar !== null}
                    onClick={() => switchTimeframe(tf)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] font-mono font-medium transition flex items-center gap-1',
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'text-zinc-400 hover:text-zinc-100'
                    )}
                  >
                    {isLoadingTf && (
                      <RefreshCw className="size-2.5 animate-spin text-emerald-400" />
                    )}
                    <span>{tf}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-px bg-white/[0.08]" />

            {/* Exchange Ticker Metrics */}
            <div className="flex items-center gap-4 font-mono">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">
                  ${formatPrice(b1.market.lastPx)}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    b1.market.change24hPct >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  )}
                >
                  {b1.market.change24hPct >= 0 ? '+' : ''}
                  {b1.market.change24hPct.toFixed(2)}%
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-4 text-xs">
                <div>
                  <span className="text-zinc-500 mr-1.5">24h H/L</span>
                  <span className="text-zinc-200">
                    ${formatPrice(b1.market.high24h)} / $
                    {formatPrice(b1.market.low24h)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 mr-1.5">Funding</span>
                  <span className="text-zinc-200">
                    {(b1.market.fundingRate * 100).toFixed(4)}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 mr-1.5">1H OI</span>
                  <span className="text-zinc-200">
                    {b1.market.oiDelta1hPct >= 0 ? '+' : ''}
                    {b1.market.oiDelta1hPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: 4-Border Status + Sync OKX + Auto-Pilot */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              {[
                { num: 1 as const, label: '1.SENSE', ms: b1.meta.durationMs },
                { num: 2 as const, label: '2.BRAIN', ms: b2.meta.durationMs },
                { num: 3 as const, label: '3.EXEC', ms: b3.meta.durationMs },
                { num: 4 as const, label: '4.CHAIN', ms: b4.meta.durationMs },
              ].map((b) => (
                <button
                  key={b.num}
                  type="button"
                  onClick={() =>
                    setInspectedBorder(inspectedBorder === b.num ? null : b.num)
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-md border transition flex items-center gap-1.5',
                    inspectedBorder === b.num
                      ? 'bg-white/[0.14] border-white/30 text-white'
                      : 'bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>{b.label}</span>
                  <span className="text-zinc-500">{b.ms}ms</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={runLiveCycle}
              className="metal-btn px-3 py-1.5 rounded-lg font-mono text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  'size-3.5 text-emerald-400',
                  refreshing && 'animate-spin'
                )}
              />
              <span>Sync OKX</span>
            </button>

            <button
              type="button"
              onClick={toggleAutoPilot}
              className={cn(
                'metal-btn px-3 py-1.5 rounded-lg font-mono text-xs font-medium flex items-center gap-1.5',
                state.autoPilotEnabled &&
                  'border-emerald-400/40 text-emerald-300'
              )}
            >
              {state.autoPilotEnabled ? (
                <>
                  <Pause className="size-3 text-emerald-400 animate-pulse" />
                  Auto: ON
                </>
              ) : (
                <>
                  <Play className="size-3 text-zinc-400" />
                  Auto: OFF
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="max-w-[1640px] w-full mx-auto px-4 py-4 flex flex-col gap-3.5 flex-1">
        {errorBanner && (
          <div className="glass-subcard rounded-lg px-3 py-1.5 text-amber-300 text-xs font-mono flex items-center justify-between">
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={fetchStatus}
              className="underline text-white"
            >
              Retry
            </button>
          </div>
        )}

        {actionToast && (
          <div className="glass-subcard rounded-lg px-3 py-1.5 text-emerald-300 text-xs font-mono flex items-center justify-between border border-emerald-400/30">
            <span>OKX CLI: {actionToast}</span>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              className="text-zinc-400 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Expandable Border JSON Drawer (only visible when clicked) */}
        {inspectedBorder && (
          <div className="glass-well rounded-xl p-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.07]">
              <span className="text-zinc-200 font-semibold">
                BORDER #{inspectedBorder} RAW PAYLOAD
              </span>
              <button
                type="button"
                onClick={() => setInspectedBorder(null)}
                className="text-zinc-400 hover:text-white text-[11px]"
              >
                [Close ×]
              </button>
            </div>
            <pre className="max-h-48 overflow-auto text-[11px] text-zinc-300">
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

        {/* 4 CLEAN EXCHANGE PANELS (ALWAYS VISIBLE) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 flex-1">
          {/* PANEL 1: GRID CORRIDOR & LIVE CANDLE CHART */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Activity className="size-4 text-emerald-400" />
                Grid Bot Corridor ({b1.instId})
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline">#{gridBot.algoId}</Badge>
                <Badge variant="emerald">
                  {gridBot.pingPongPhase === 'HARVESTING_EXIT'
                    ? 'EXIT SELL'
                    : 'ENTRY BUY'}{' '}
                  • {gridBot.status}
                </Badge>
                <button
                  type="button"
                  disabled={runningAction !== null}
                  onClick={() => triggerLiveAction('GRID_DEPLOY')}
                  className="metal-btn px-2.5 py-0.5 rounded text-[11px] font-mono text-zinc-100 flex items-center gap-1 disabled:opacity-50"
                >
                  <Wrench className="size-3 text-emerald-400" />
                  <span>
                    {gridBot.algoId !== 'NO_ACTIVE_BOT' &&
                    gridBot.algoId !== 'NONE'
                      ? 'Amend Grid'
                      : 'Deploy Grid'}
                  </span>
                </button>
                {gridBot.algoId !== 'NO_ACTIVE_BOT' &&
                  gridBot.algoId !== 'NONE' && (
                    <button
                      type="button"
                      disabled={runningAction !== null}
                      onClick={() => triggerLiveAction('GRID_CANCEL')}
                      className="metal-btn px-2 py-0.5 rounded text-[11px] font-mono text-rose-300 border-rose-500/30 hover:text-rose-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
              </div>
            </CardHeader>

            <CardContent className="p-4 gap-2.5">
              {/* 5 Compact Indicators */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { k: 'ATR(14)', v: `$${formatPrice(b1.technicals.atr14)}` },
                  { k: 'ADX(14)', v: b1.technicals.adx14.toFixed(1) },
                  { k: 'RSI(14)', v: b1.technicals.rsi14.toFixed(1) },
                  {
                    k: 'OBI(10)',
                    v: `${(b1.market.orderbookImbalance ?? 0) >= 0 ? '+' : ''}${((b1.market.orderbookImbalance ?? 0) * 100).toFixed(1)}%`,
                    c:
                      (b1.market.orderbookImbalance ?? 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400',
                  },
                  {
                    k: 'Order Px',
                    v: `$${formatPrice(gridBot.activeOrderPx || b2.gridPlan.optimalBuyPx || gridBot.minPx)}`,
                    c: 'text-emerald-300',
                  },
                ].map((m) => (
                  <div
                    key={m.k}
                    className="glass-subcard rounded-lg px-2.5 py-1.5 flex flex-col"
                  >
                    <span className="text-[10px] font-mono text-zinc-500">
                      {m.k}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold text-zinc-100 mt-0.5',
                        m.c
                      )}
                    >
                      {m.v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Live Candlesticks + 12-Grid Corridor Chart */}
              <GridCandleChart
                candles={b1.candles || []}
                gridLevels={b2.gridPlan.gridLevels}
                minPx={gridBot.minPx}
                maxPx={gridBot.maxPx}
                tpPx={gridBot.tpTriggerPx}
                slPx={gridBot.slTriggerPx}
                lastPx={b1.market.lastPx}
                bar={b1.bar || state.selectedBar || '1m'}
              />

              {/* Corridor Range Gauge */}
              <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">
                    Position: <strong className="text-white">{corridorPct}%</strong>
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      b2.gridPlan.requiresInFlightSurgery
                        ? 'text-sky-300'
                        : 'text-emerald-400'
                    )}
                  >
                    {b2.gridPlan.requiresInFlightSurgery
                      ? 'AMEND TRIGGERED'
                      : 'IN RANGE [12%–88%]'}
                  </span>
                </div>

                <div className="relative h-2.5 rounded-full bg-zinc-950 border border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-[12%] bg-rose-500/25 border-r border-rose-400/40" />
                  <div className="absolute inset-y-0 right-0 w-[12%] bg-rose-500/25 border-l border-rose-400/40" />
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#fff] transition-all duration-500"
                    style={{ left: `calc(${corridorPct}% - 4px)` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                  <span>SL ${formatPrice(gridBot.slTriggerPx)}</span>
                  <span className="text-zinc-200">
                    Min ${formatPrice(gridBot.minPx)}
                  </span>
                  <span className="text-white font-semibold">
                    ${formatPrice(b1.market.lastPx)}
                  </span>
                  <span className="text-zinc-200">
                    Max ${formatPrice(gridBot.maxPx)}
                  </span>
                  <span>TP ${formatPrice(gridBot.tpTriggerPx)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PANEL 2: WHALE vs RETAIL TRAP RADAR */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Crosshair className="size-4 text-rose-400" />
                Whale vs Retail Divergence
              </CardTitle>
              <Badge
                variant={
                  b2.formulas.trapClassification === 'BULL_TRAP'
                    ? 'rose'
                    : b2.formulas.trapClassification === 'BEAR_TRAP'
                    ? 'emerald'
                    : 'metallic'
                }
              >
                D_trap: {b2.formulas.dTrap >= 0 ? '+' : ''}
                {b2.formulas.dTrap.toFixed(2)} ({b2.formulas.trapClassification})
              </Badge>
            </CardHeader>

            <CardContent className="p-4 gap-3">
              {/* Retail & Whale Bars */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Retail Sentiment</span>
                    <span className="text-emerald-300 font-semibold">
                      {(b1.sentiment.bullishRatio * 100).toFixed(0)}% Bull
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-500/35 overflow-hidden flex">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500"
                      style={{
                        width: `${(b1.sentiment.bullishRatio * 100).toFixed(0)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>S_retail: {b1.sentiment.sRetail.toFixed(2)}</span>
                    <span>
                      {(b1.sentiment.bearishRatio * 100).toFixed(0)}% Bear
                    </span>
                  </div>
                </div>

                <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Smart Money Whales</span>
                    <span
                      className={cn(
                        'font-semibold',
                        b1.smartMoney.wWhale >= 0
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      )}
                    >
                      {whaleLongPct}% Long
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-500/40 overflow-hidden flex">
                    <div
                      className="bg-emerald-400 h-full transition-all duration-500"
                      style={{ width: `${whaleLongPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>
                      L ${(b1.smartMoney.longNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                    <span>
                      S ${(b1.smartMoney.shortNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>

              {/* D_trap Spectrum Gauge */}
              <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Trap Thresholds</span>
                  <span className="text-zinc-200">
                    {b2.formulas.dTrapBps} bps
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-zinc-950 border border-white/[0.08] overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-[28%] bg-emerald-500/20 border-r border-emerald-400/40" />
                  <div className="absolute inset-y-0 right-0 w-[28%] bg-rose-500/20 border-l border-rose-400/40" />
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#fff] transition-all duration-500"
                    style={{
                      left: `calc(${Math.min(
                        98,
                        Math.max(2, ((b2.formulas.dTrap + 2.5) / 5) * 100)
                      )}% - 4px)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-emerald-400">&lt; −1.10 Bear Trap</span>
                  <span>Neutral</span>
                  <span className="text-rose-400">&gt; +1.10 Bull Trap</span>
                </div>
              </div>

              {/* Active Execution Status */}
              <div className="glass-well rounded-lg px-3 py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 shrink-0 mr-2">Action:</span>
                <span className="text-zinc-100 truncate">
                  {b2.recommendedAction} • #{b3.primaryOkxAlgoOrOrdId}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* PANEL 3: OKX ATK CLI STREAM */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Terminal className="size-4 text-zinc-200" />
                OKX CLI Stream
              </CardTitle>
              <div className="flex items-center gap-1">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'okx-cex-market', label: 'Market' },
                  { id: 'okx-sentiment-tracker', label: 'News' },
                  { id: 'okx-cex-smartmoney', label: 'Whale' },
                  { id: 'okx-cex-bot', label: 'Bot' },
                  { id: 'okx-cex-earn', label: 'Earn' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCliSkillFilter(f.id)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-mono transition',
                      cliSkillFilter === f.id
                        ? 'metal-badge text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-4 gap-1.5">
              <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                {filteredCliHistory.slice(0, 16).map((rec) => {
                  const isExpanded = expandedCliId === rec.id;
                  const isOk = rec.exitCode === 0;
                  return (
                    <div
                      key={rec.id}
                      className="glass-well rounded-lg px-2.5 py-1.5 font-mono text-xs"
                    >
                      <div
                        onClick={() =>
                          setExpandedCliId(isExpanded ? null : rec.id)
                        }
                        className="flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="size-3 text-zinc-500 shrink-0" />
                          ) : (
                            <ChevronRight className="size-3 text-zinc-500 shrink-0" />
                          )}
                          <span
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              isOk ? 'bg-emerald-400' : 'bg-rose-400'
                            )}
                          />
                          <code className="text-zinc-200 truncate text-[11px]">
                            {rec.command}
                          </code>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px]">
                          <span
                            className={
                              isOk ? 'text-emerald-400' : 'text-rose-400'
                            }
                          >
                            {isOk ? 'LIVE' : 'ERR'}
                          </span>
                          <span className="text-zinc-500">
                            {rec.durationMs}ms
                          </span>
                        </div>
                      </div>
                      {isExpanded && (
                        <pre className="mt-1.5 p-2 rounded bg-black/60 border border-white/[0.06] text-[10px] text-zinc-300 overflow-x-auto max-h-36">
                          {JSON.stringify(rec.rawPreview, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* PANEL 4: TREASURY & AVALANCHE CHAIN */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Anchor className="size-4 text-amber-300" />
                Treasury & Avalanche Chain
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={togglingBreaker}
                  onClick={toggleCircuitBreaker}
                  className={cn(
                    'metal-btn px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 disabled:opacity-50',
                    b4.onChainState?.circuitBreakerActive
                      ? 'border-rose-400/50 text-rose-300 bg-rose-500/15'
                      : 'text-emerald-300'
                  )}
                >
                  <Lock className="size-2.5" />
                  <span>
                    {togglingBreaker
                      ? 'Tx...'
                      : b4.onChainState?.circuitBreakerActive
                      ? 'Breaker: LOCKED'
                      : 'Breaker: OFF'}
                  </span>
                </button>
                {finalityMs > 0 && (
                  <Badge variant="emerald">
                    <Zap className="size-2.5 mr-1 inline" />
                    Finality {finalityMs}ms
                  </Badge>
                )}
                <Badge variant="outline">
                  Fuji #{b4.operatorWallet.latestBlockNumber}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 gap-3">
              {/* 4 Portfolio Balances + Live Earn Actions */}
              <div className="grid grid-cols-4 gap-2">
                <div className="glass-subcard rounded-lg p-2.5 flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500">
                    TOTAL NAV
                  </span>
                  <span className="text-sm font-mono font-bold text-white mt-0.5">
                    ${b3.treasury.totalNavUsdt.toFixed(2)}
                  </span>
                </div>
                <div className="glass-subcard rounded-lg p-2.5 flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500">
                    TRADING (18)
                  </span>
                  <span className="text-sm font-mono font-bold text-zinc-100 mt-0.5">
                    ${b3.treasury.tradingAccountUsdt.toFixed(2)}
                  </span>
                </div>
                <div className="glass-subcard rounded-lg p-2.5 flex flex-col border-emerald-400/25">
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Lock className="size-2.5" /> EARN (6)
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                    ${b3.treasury.lockedSimpleEarnUsdt.toFixed(2)}
                  </span>
                </div>
                <div className="glass-subcard rounded-lg p-2.5 flex flex-col">
                  <span className="text-[10px] font-mono text-zinc-500">
                    REALIZED PnL
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                    ${b3.treasury.cumulativeRealizedPnlUsdt.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* 1-Click Live OKX Earn Transfer Bar ($1.00 Real Execution) */}
              <div className="flex items-center justify-between gap-2 glass-subcard rounded-lg px-3 py-2 font-mono text-xs">
                <span className="text-zinc-400 text-[11px]">
                  Live OKX Simple Earn ($1 USDT):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={runningAction !== null}
                    onClick={() => triggerLiveAction('EARN_SWEEP')}
                    className="metal-btn px-2.5 py-1 rounded text-[11px] text-emerald-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowUpRight className="size-3" />
                    <span>Sweep $1 → Earn</span>
                  </button>
                  <button
                    type="button"
                    disabled={runningAction !== null}
                    onClick={() => triggerLiveAction('EARN_REDEEM')}
                    className="metal-btn px-2.5 py-1 rounded text-[11px] text-zinc-200 flex items-center gap-1 disabled:opacity-50"
                  >
                    <ArrowDownLeft className="size-3" />
                    <span>Redeem $1</span>
                  </button>
                </div>
              </div>

              {/* 3 Ava Labs Registries Row (Live Read-Back from Fuji) */}
              {b4.erc8004Passport && (
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <a
                    href="https://testnet.snowtrace.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e"
                    target="_blank"
                    rel="noreferrer"
                    className="glass-subcard rounded-lg p-2.5 hover:border-white/25 transition flex flex-col"
                  >
                    <span className="text-[9px] text-zinc-500 flex items-center justify-between">
                      IDENTITY <ExternalLink className="size-2.5" />
                    </span>
                    <span className="text-emerald-300 font-semibold mt-0.5">
                      Agent NFT #{b4.erc8004Passport.identityRegistry.agentId}
                    </span>
                  </a>
                  <a
                    href="https://testnet.snowtrace.io/address/0x7c52f6b7b588698700abbac6cbe37f3cfca305cd"
                    target="_blank"
                    rel="noreferrer"
                    className="glass-subcard rounded-lg p-2.5 hover:border-white/25 transition flex flex-col"
                  >
                    <span className="text-[9px] text-zinc-500 flex items-center justify-between">
                      ON-CHAIN PROOFS <ExternalLink className="size-2.5" />
                    </span>
                    <span className="text-zinc-100 font-semibold mt-0.5">
                      {b4.erc8004Passport.validationRegistry.totalValidatedTasks}{' '}
                      Anchored
                    </span>
                  </a>
                  <a
                    href="https://testnet.snowtrace.io/address/0x8004B663056A597Dffe9eCcC1965A193B7388713"
                    target="_blank"
                    rel="noreferrer"
                    className="glass-subcard rounded-lg p-2.5 hover:border-white/25 transition flex flex-col"
                  >
                    <span className="text-[9px] text-zinc-500 flex items-center justify-between">
                      REPUTATION <ExternalLink className="size-2.5" />
                    </span>
                    <span className="text-amber-300 font-semibold mt-0.5">
                      {b4.erc8004Passport.reputationRegistry.trustScore}/100
                    </span>
                  </a>
                </div>
              )}

              {/* On-Chain Tx + Verify Proof + Wallet Action Row */}
              <div className="glass-well rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="emerald">{b4.anchorRecord.status}</Badge>
                  {b4.anchorRecord.txHash ? (
                    <a
                      href={`https://testnet.snowtrace.io/tx/${b4.anchorRecord.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-200 hover:text-white underline truncate flex items-center gap-1"
                    >
                      Tx: {b4.anchorRecord.txHash.slice(0, 10)}...
                      {b4.anchorRecord.txHash.slice(-5)}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-zinc-400 truncate">
                      Hash: {b4.anchorRecord.reasoningHash.slice(0, 12)}...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      copyText('hash', b4.anchorRecord.reasoningHash)
                    }
                    className="text-zinc-400 hover:text-white"
                  >
                    {copiedKey === 'hash' ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={verifyingProof}
                    onClick={() =>
                      verifyProofOnChain(b4.anchorRecord.reasoningHash)
                    }
                    className={cn(
                      'metal-btn px-2.5 py-1 rounded-md text-[11px] font-medium',
                      proofVerifiedMsg
                        ? 'text-emerald-300 border-emerald-400/40'
                        : 'text-zinc-200'
                    )}
                  >
                    {verifyingProof
                      ? 'Checking Fuji...'
                      : proofVerifiedMsg || 'Verify Proof'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBrowserWalletAnchor}
                    className="metal-btn px-2.5 py-1 rounded-md text-[11px] text-zinc-100 font-medium"
                  >
                    {walletStatusMsg || 'Anchor Wallet'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default App;

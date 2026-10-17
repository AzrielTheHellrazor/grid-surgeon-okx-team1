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

const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_BASE?: string } }).env
    ?.VITE_API_BASE || 'http://localhost:4001/api';

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
  entryFillPx,
  activeOrderPx,
  tranche2OrderPx,
  activeBuyOrderPx,
  pingPongPhase,
  avaxInventory,
}: {
  candles: CandleBar[];
  gridLevels: number[];
  minPx: number;
  maxPx: number;
  tpPx: number;
  slPx: number;
  lastPx: number;
  bar?: string;
  entryFillPx?: number;
  activeOrderPx?: number;
  tranche2OrderPx?: number;
  activeBuyOrderPx?: number;
  pingPongPhase?: 'SEEKING_ENTRY' | 'HARVESTING_EXIT' | 'IDLE';
  avaxInventory?: number;
}) {
  const bars = candles.slice(-36);
  if (bars.length === 0) return null;

  const extraOrderPrices = [
    entryFillPx,
    activeOrderPx,
    tranche2OrderPx,
    activeBuyOrderPx,
  ].filter(
    (p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0
  );

  const allPrices = [
    ...bars.flatMap((b) => [b.high, b.low]),
    minPx,
    maxPx,
    tpPx,
    slPx,
    lastPx,
    ...extraOrderPrices,
  ].filter((p) => Number.isFinite(p) && p > 0);

  const rawMax = Math.max(...allPrices);
  const rawMin = Math.min(...allPrices);
  const rawSpan = Math.max(0.0001, rawMax - rawMin);
  const chartMax = rawMax + rawSpan * 0.08;
  const chartMin = rawMin - rawSpan * 0.08;
  const span = Math.max(0.0001, chartMax - chartMin);

  const W = 560;
  const H = 148;
  const padTop = 6;
  const padBottom = 6;
  const plotRight = W - 98;

  const yScale = (px: number) =>
    Math.min(
      H - padBottom,
      Math.max(
        padTop,
        H - padBottom - ((px - chartMin) / span) * (H - padTop - padBottom)
      )
    );

  const barStep = plotRight / bars.length;
  const bodyWidth = Math.max(3, barStep * 0.56);

  const showVwap =
    Boolean(entryFillPx && entryFillPx > 0) && (avaxInventory || 0) >= 0.05;
  const showActiveOrder = Boolean(activeOrderPx && activeOrderPx > 0);
  const showTranche2 = Boolean(tranche2OrderPx && tranche2OrderPx > 0);

  // Build right-edge pill badges and run 1D Label Collision Solver
  const rawBadges: Array<{
    id: string;
    px: number;
    text: string;
    stroke: string;
    fill: string;
    textColor: string;
  }> = [
    {
      id: 'TP',
      px: tpPx,
      text: `GRID MAX $${tpPx.toFixed(3)}`,
      stroke: 'rgba(52,211,153,0.55)',
      fill: 'rgba(6,78,59,0.75)',
      textColor: '#6ee7b7',
    },
    ...(showTranche2 && tranche2OrderPx
      ? [
          {
            id: 'T2_SELL',
            px: tranche2OrderPx,
            text: `T2 SELL $${tranche2OrderPx.toFixed(3)}`,
            stroke: '#34d399',
            fill: 'rgba(6,95,70,0.85)',
            textColor: '#a7f3d0',
          },
        ]
      : []),
    ...(showActiveOrder && activeOrderPx
      ? [
          {
            id: 'T1_ORDER',
            px: activeOrderPx,
            text: `${
              pingPongPhase === 'HARVESTING_EXIT' ? 'T1 SELL' : 'BUY'
            } $${activeOrderPx.toFixed(3)}`,
            stroke:
              pingPongPhase === 'HARVESTING_EXIT' ? '#10b981' : '#06b6d4',
            fill:
              pingPongPhase === 'HARVESTING_EXIT'
                ? 'rgba(16,185,129,0.22)'
                : 'rgba(6,182,212,0.22)',
            textColor:
              pingPongPhase === 'HARVESTING_EXIT' ? '#6ee7b7' : '#67e8f9',
          },
        ]
      : []),
    ...(showVwap && entryFillPx
      ? [
          {
            id: 'VWAP',
            px: entryFillPx,
            text: `VWAP $${entryFillPx.toFixed(3)}`,
            stroke: '#fbbf24',
            fill: 'rgba(120,53,15,0.82)',
            textColor: '#fde68a',
          },
        ]
      : []),
    {
      id: 'LAST',
      px: lastPx,
      text: `LAST $${lastPx.toFixed(3)}`,
      stroke: 'rgba(255,255,255,0.65)',
      fill: 'rgba(39,39,42,0.92)',
      textColor: '#ffffff',
    },
    {
      id: 'SL',
      px: slPx,
      text: `GRID MIN $${slPx.toFixed(3)}`,
      stroke: 'rgba(251,113,133,0.55)',
      fill: 'rgba(136,19,55,0.75)',
      textColor: '#fda4af',
    },
  ];

  const minYGap = 13;
  const minBound = padTop + 8;
  const maxBound = H - padBottom - 8;
  const solvedBadges = rawBadges
    .map((b) => {
      const rawY = yScale(b.px);
      return {
        ...b,
        rawY,
        y: Math.min(maxBound, Math.max(minBound, rawY)),
      };
    })
    .sort((a, b) => a.rawY - b.rawY);

  for (let i = 1; i < solvedBadges.length; i++) {
    if (solvedBadges[i].y < solvedBadges[i - 1].y + minYGap) {
      solvedBadges[i].y = solvedBadges[i - 1].y + minYGap;
    }
  }
  if (solvedBadges.length > 0) {
    solvedBadges[solvedBadges.length - 1].y = Math.min(
      maxBound,
      solvedBadges[solvedBadges.length - 1].y
    );
    for (let i = solvedBadges.length - 2; i >= 0; i--) {
      if (solvedBadges[i].y > solvedBadges[i + 1].y - minYGap) {
        solvedBadges[i].y = Math.max(
          minBound,
          solvedBadges[i + 1].y - minYGap
        );
      }
    }
  }

  return (
    <div className="glass-well rounded-xl p-2.5 relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 mb-1 px-1">
        <span>
          {bar} CANDLES ({bars.length}) + 12 GRID LEVELS
        </span>
        <div className="flex items-center gap-2">
          {tranche2OrderPx && tranche2OrderPx > 0 && activeOrderPx ? (
            <span className="text-emerald-300 font-semibold">
              T1 ${activeOrderPx.toFixed(3)} / T2 ${tranche2OrderPx.toFixed(3)}
            </span>
          ) : null}
          <span className="text-zinc-300">
            Range: ${formatPrice(minPx)} – ${formatPrice(maxPx)}
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[148px] overflow-visible"
        preserveAspectRatio="none"
      >
        {/* Grid Corridor Shaded Band */}
        <rect
          x={0}
          y={yScale(maxPx)}
          width={plotRight}
          height={Math.max(2, yScale(minPx) - yScale(maxPx))}
          fill="rgba(255,255,255,0.025)"
        />

        {/* Translucent Target Proximity Band */}
        {activeOrderPx && activeOrderPx > 0 && lastPx > 0 && (
          <rect
            x={0}
            y={Math.min(yScale(lastPx), yScale(activeOrderPx))}
            width={plotRight}
            height={Math.max(
              1.5,
              Math.abs(yScale(activeOrderPx) - yScale(lastPx))
            )}
            fill={
              pingPongPhase === 'HARVESTING_EXIT'
                ? 'rgba(16,185,129,0.06)'
                : 'rgba(6,182,212,0.06)'
            }
          />
        )}

        {/* 12 Horizontal Grid Lines */}
        {gridLevels.map((lvl, idx) => {
          const y = yScale(lvl);
          const isBoundary = idx === 0 || idx === gridLevels.length - 1;
          return (
            <line
              key={idx}
              x1={0}
              y1={y}
              x2={plotRight}
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
          y1={yScale(tpPx)}
          x2={plotRight}
          y2={yScale(tpPx)}
          stroke="rgba(52,211,153,0.45)"
          strokeWidth={0.8}
          strokeDasharray="4 4"
        />
        <line
          x1={0}
          y1={yScale(slPx)}
          x2={plotRight}
          y2={yScale(slPx)}
          stroke="rgba(251,113,133,0.45)"
          strokeWidth={0.8}
          strokeDasharray="4 4"
        />

        {/* Candlesticks */}
        {bars.map((barItem, i) => {
          const cx = i * barStep + barStep / 2;
          const isBull = barItem.close >= barItem.open;
          const color = isBull ? '#34d399' : '#fb7185';
          const highY = yScale(barItem.high);
          const lowY = yScale(barItem.low);
          const topY = yScale(Math.max(barItem.open, barItem.close));
          const botY = yScale(Math.min(barItem.open, barItem.close));
          const bodyH = Math.max(1.5, botY - topY);

          return (
            <g key={barItem.ts}>
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

        {/* Amber Dashed VWAP Cost Basis Line (#fbbf24) */}
        {showVwap && entryFillPx && (
          <line
            x1={0}
            y1={yScale(entryFillPx)}
            x2={plotRight}
            y2={yScale(entryFillPx)}
            stroke="#fbbf24"
            strokeDasharray="4 2"
            strokeWidth="1.2"
          />
        )}

        {/* Primary Active Order Line (activeOrderPx) */}
        {showActiveOrder && activeOrderPx && (
          <line
            x1={0}
            y1={yScale(activeOrderPx)}
            x2={plotRight}
            y2={yScale(activeOrderPx)}
            stroke={pingPongPhase === 'HARVESTING_EXIT' ? '#10b981' : '#06b6d4'}
            strokeWidth="1.4"
          />
        )}

        {/* Tranche 2 Runner Line (tranche2OrderPx) */}
        {showTranche2 && tranche2OrderPx && (
          <line
            x1={0}
            y1={yScale(tranche2OrderPx)}
            x2={plotRight}
            y2={yScale(tranche2OrderPx)}
            stroke="#34d399"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
        )}

        {/* Live Price Highlight Line */}
        <line
          x1={0}
          y1={yScale(lastPx)}
          x2={plotRight}
          y2={yScale(lastPx)}
          stroke="#ffffff"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {/* Collision-Solved Right-Edge Pill Badges */}
        {solvedBadges.map((b) => (
          <g key={b.id}>
            <line
              x1={plotRight}
              y1={b.rawY}
              x2={plotRight + 5}
              y2={b.y}
              stroke={b.stroke}
              strokeWidth={0.8}
            />
            <rect
              x={plotRight + 5}
              y={b.y - 5.5}
              width={W - plotRight - 7}
              height={11}
              rx={2.5}
              fill={b.fill}
              stroke={b.stroke}
              strokeWidth={0.7}
            />
            <text
              x={plotRight + 9}
              y={b.y + 2.5}
              fill={b.textColor}
              fontSize="7.2"
              fontFamily="monospace"
              fontWeight="600"
            >
              {b.text}
            </text>
          </g>
        ))}
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
  const [expandedCliId, setExpandedCliId] = useState<string | null>(null);
  const [cliSkillFilter, setCliSkillFilter] = useState<string>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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

          {/* Right: Sync OKX + Auto-Pilot */}
          <div className="flex items-center gap-2 ml-auto">
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

        {/* 4 CLEAN EXCHANGE PANELS (ALWAYS VISIBLE) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 flex-1">
          {/* PANEL 1: GRID CORRIDOR & LIVE CANDLE CHART */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Activity className="size-4 text-emerald-400" />
                1. Live Order Corridor ({b1.instId})
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">#{gridBot.algoId.slice(-6)}</Badge>
                <Badge variant="emerald">
                  {gridBot.pingPongPhase === 'HARVESTING_EXIT'
                    ? 'HARVESTING SELL'
                    : 'SEEKING BUY'}
                </Badge>
                <Badge variant="amber">
                  {(gridBot?.avaxInventory || 0).toFixed(2)}{' '}
                  {b1.instId.split('-')[0]} @ $
                  {(gridBot?.entryFillPx || b1.market.lastPx).toFixed(3)} • RT:{' '}
                  {gridBot?.roundTripsCompleted ?? 0}
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
              {/* 5 Compact Indicators (Zero truncation + English explanations on hover) */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  {
                    k: 'ATR(14) Vol',
                    v: `$${formatPrice(b1.technicals.atr14)}`,
                    hint: 'Average True Range (14 bars): Average price volatility per candle',
                  },
                  {
                    k: 'ADX(14) Trend',
                    v: b1.technicals.adx14.toFixed(1),
                    hint: 'Trend Strength (<25 ranging grid regime, >25 strong directional trend)',
                  },
                  {
                    k: 'RSI(14) Mom',
                    v: b1.technicals.rsi14.toFixed(1),
                    hint: 'Relative Strength Index (<30 oversold, >70 overbought)',
                  },
                  {
                    k: 'Book Skew (OBI)',
                    v: `${(b1.market.orderbookImbalance ?? 0) >= 0 ? '+' : ''}${((b1.market.orderbookImbalance ?? 0) * 100).toFixed(1)}%`,
                    c:
                      (b1.market.orderbookImbalance ?? 0) >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400',
                    hint: 'Top-10 Level Order Book Imbalance (Positive = Bid Heavy, Negative = Ask Heavy)',
                  },
                  {
                    k: gridBot?.tranche2OrderPx ? 'T1 / T2 Target' : 'Active Order',
                    v: gridBot?.tranche2OrderPx
                      ? `$${gridBot.activeOrderPx?.toFixed(3)}/$${gridBot.tranche2OrderPx.toFixed(3)}`
                      : `$${formatPrice(gridBot.activeOrderPx || b2.gridPlan.optimalBuyPx || gridBot.minPx)}`,
                    c: 'text-emerald-300 text-[11px]',
                    hint: 'Live 2-Tranche Take-Profit Sell Orders currently open on OKX',
                  },
                ].map((m) => (
                  <div
                    key={m.k}
                    title={m.hint}
                    className="glass-subcard rounded-lg px-2.5 py-1.5 flex flex-col cursor-help"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 truncate">
                      {m.k}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold text-zinc-100 mt-0.5 truncate',
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
                entryFillPx={gridBot?.entryFillPx}
                activeOrderPx={gridBot?.activeOrderPx}
                tranche2OrderPx={gridBot?.tranche2OrderPx}
                activeBuyOrderPx={gridBot?.activeBuyOrderPx}
                pingPongPhase={gridBot?.pingPongPhase}
                avaxInventory={gridBot?.avaxInventory}
              />

              {/* Corridor Range Gauge */}
              <div className="glass-subcard rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">
                    Corridor Position:{' '}
                    <strong className="text-white">{corridorPct}%</strong>
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
                      ? 'IN-FLIGHT SURGERY ACTIVE (AMEND)'
                      : 'SAFE CORRIDOR [12%–88%]'}
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
                  <span>Grid Min ${formatPrice(gridBot.slTriggerPx)}</span>
                  <span className="text-zinc-200">
                    Lower ${formatPrice(gridBot.minPx)}
                  </span>
                  <span className="text-white font-semibold">
                    Last ${formatPrice(b1.market.lastPx)}
                  </span>
                  <span className="text-zinc-200">
                    Upper ${formatPrice(gridBot.maxPx)}
                  </span>
                  <span>Grid Max ${formatPrice(gridBot.tpTriggerPx)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PANEL 2: WHALE vs RETAIL TRAP RADAR */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Crosshair className="size-4 text-rose-400" />
                2. Whale vs Retail Trap Radar
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
                {b2.formulas.dTrap.toFixed(2)} (
                {b2.formulas.trapClassification === 'NO_TRAP'
                  ? 'NEUTRAL / SAFE'
                  : b2.formulas.trapClassification === 'BULL_TRAP'
                  ? 'BULL TRAP'
                  : 'BEAR TRAP'}
                )
              </Badge>
            </CardHeader>

            <CardContent className="p-4 gap-3">
              {/* Retail & Whale Bars */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-zinc-400">Retail Crowd</span>
                    <span className="text-emerald-300 font-semibold">
                      {(b1.sentiment.bullishRatio * 100).toFixed(0)}% Bullish
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
                      {(b1.sentiment.bearishRatio * 100).toFixed(0)}% Bearish
                    </span>
                  </div>
                </div>

                <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
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
                      Long ${(b1.smartMoney.longNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                    <span>
                      Short ${(b1.smartMoney.shortNotionalUsd / 1e6).toFixed(2)}M
                    </span>
                  </div>
                </div>
              </div>

              {/* D_trap Spectrum Gauge */}
              <div className="glass-subcard rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">
                    Trap Thresholds (D_trap = Retail − 1.5×Whale)
                  </span>
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
                  <span className="text-emerald-400">
                    &lt; −1.10 Bear Trap (Long Signal)
                  </span>
                  <span>Safe Corridor</span>
                  <span className="text-rose-400">
                    &gt; +1.10 Bull Trap (Risk!)
                  </span>
                </div>
              </div>

              {/* Active Execution Status */}
              <div className="glass-well rounded-lg px-3 py-2.5 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 shrink-0 mr-2">Decision:</span>
                <span className="text-zinc-100 truncate">
                  {b2.recommendedAction === 'AMEND_GRID_IN_FLIGHT'
                    ? 'Shift Corridor & Protect Take-Profit Orders'
                    : b2.recommendedAction === 'HOLD_GRID_CORRIDOR'
                    ? 'Hold Split Take-Profit Orders (FIFO Protected)'
                    : b2.recommendedAction}{' '}
                  • #{b3.primaryOkxAlgoOrOrdId.slice(-8)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* PANEL 3: OKX ATK CLI STREAM */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle>
                <Terminal className="size-4 text-zinc-200" />
                3. Live OKX CLI Proof Stream
              </CardTitle>
              <div className="flex items-center gap-1">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'okx-cex-market', label: 'Market' },
                  { id: 'okx-sentiment-tracker', label: 'News' },
                  { id: 'okx-cex-smartmoney', label: 'Whale' },
                  { id: 'okx-cex-bot', label: 'Bot' },
                  { id: 'okx-cex-trade', label: 'Spot/Fills' },
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
                4. Treasury Vault & Avalanche C-Chain Seal
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
                <div
                  title="Total Account Net Asset Value on OKX (AVAX + USDT + Simple Earn)"
                  className="glass-subcard rounded-lg p-2.5 flex flex-col cursor-help"
                >
                  <span className="text-[10px] font-mono text-zinc-500">
                    TOTAL EQUITY
                  </span>
                  <span className="text-sm font-mono font-bold text-white mt-0.5">
                    ${b3.treasury.totalNavUsdt.toFixed(2)}
                  </span>
                </div>
                <div
                  title="Active Spot Trading Balance on OKX (AVAX + USDT)"
                  className="glass-subcard rounded-lg p-2.5 flex flex-col cursor-help"
                >
                  <span className="text-[10px] font-mono text-zinc-500">
                    OKX TRADING
                  </span>
                  <span className="text-sm font-mono font-bold text-zinc-100 mt-0.5">
                    ${b3.treasury.tradingAccountUsdt.toFixed(2)}
                  </span>
                </div>
                <div
                  title="Realized Profit Locked in OKX Simple Earn Yield Vault"
                  className="glass-subcard rounded-lg p-2.5 flex flex-col border-emerald-400/25 cursor-help"
                >
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Lock className="size-2.5" /> OKX SIMPLE EARN
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                    ${b3.treasury.lockedSimpleEarnUsdt.toFixed(2)}
                  </span>
                </div>
                <div
                  title="Cumulative Realized Net PnL across completed trading cycles"
                  className="glass-subcard rounded-lg p-2.5 flex flex-col cursor-help"
                >
                  <span className="text-[10px] font-mono text-zinc-500">
                    REALIZED PnL
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono font-bold mt-0.5',
                      b3.treasury.cumulativeRealizedPnlUsdt >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    )}
                  >
                    {b3.treasury.cumulativeRealizedPnlUsdt >= 0 ? '+' : '-'}$
                    {Math.abs(b3.treasury.cumulativeRealizedPnlUsdt).toFixed(2)}
                  </span>
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

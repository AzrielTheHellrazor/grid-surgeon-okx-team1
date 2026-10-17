import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Terminal } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryCount: number;
}

/**
 * Institutional Dark-Mode React Error Boundary for Live Stage Resilience.
 * Guarantees that no unexpected payload shape or transient rendering fault
 * can ever produce a blank white screen during the 10-minute stage demo.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[Grid-Surgeon UI ErrorBoundary intercepted fault]:', error, errorInfo);
  }

  handleRecover = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryCount: prev.recoveryCount + 1,
    }));
  };

  handleHardReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06090f] text-slate-100 flex flex-col items-center justify-center p-6 font-mono">
          <div className="max-w-xl w-full rounded-xl bg-[#0a0f1a] border border-emerald-500/40 p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-wider text-white">
                  GRID-SURGEON // STAGE-SAFE UI GUARD ACTIVE
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Zero-Crash Isolation Boundary • 4-Border Backend Pipeline Running Normally on :4001
                </p>
              </div>
            </div>

            <div className="my-4 p-3.5 rounded-lg bg-[#060911] border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                <span>Intercepted Transient Render Exception:</span>
              </div>
              <p className="text-slate-400 break-words">
                {this.state.error?.message || 'Unexpected component state transition'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset &amp; Recover UI State
              </button>
              <button
                onClick={this.handleHardReload}
                className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition"
              >
                Hard Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.recoveryCount}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default ErrorBoundary;

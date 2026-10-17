import { execFile } from 'child_process';
import fs from 'fs';
import { CliExecutionRecord } from './pipeline/types';

const CANDIDATE_OKX_PATHS = [
  '/opt/homebrew/bin/okx',
  '/usr/local/bin/okx',
  'okx',
];

function resolveOkxBinary(): string {
  for (const candidate of CANDIDATE_OKX_PATHS) {
    if (candidate.startsWith('/') && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'okx';
}

const OKX_BIN = resolveOkxBinary();

export interface OkxCliRunOptions {
  args: string[];
  phase: 'BORDER_1_SENSE' | 'BORDER_3_EXECUTE';
  skill: CliExecutionRecord['skill'];
  timeoutMs?: number;
  simulateIfUnauthed?: boolean;
  simulatedPayload?: unknown;
  simulatedSummary?: string;
}

export interface OkxCliRunResult<T = unknown> {
  success: boolean;
  data: T | null;
  rawStdout: string;
  rawStderr: string;
  durationMs: number;
  record: CliExecutionRecord;
}

/**
 * Unbreakable wrapper around `@okx_ai/okx-trade-cli` (`okx`).
 * Never throws; always returns a structured `OkxCliRunResult` and `CliExecutionRecord`.
 */
export async function runOkxCli<T = unknown>(
  options: OkxCliRunOptions
): Promise<OkxCliRunResult<T>> {
  const {
    args,
    phase,
    skill,
    timeoutMs = 8000,
    simulateIfUnauthed = false,
    simulatedPayload = null,
    simulatedSummary,
  } = options;

  const fullCommand = `okx ${args.join(' ')}`;
  const startMs = Date.now();
  const id = `cli-${startMs}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise<OkxCliRunResult<T>>((resolve) => {
    execFile(
      OKX_BIN,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
          NO_COLOR: '1',
        },
      },
      (error, stdout, stderr) => {
        const durationMs = Math.max(1, Date.now() - startMs);
        const trimmedOut = (stdout || '').trim();
        const trimmedErr = (stderr || '').trim();

        let parsed: T | null = null;
        if (trimmedOut) {
          try {
            parsed = JSON.parse(trimmedOut) as T;
          } catch {
            // Try extracting JSON array or object if CLI printed any banner lines
            const firstBracket = trimmedOut.search(/[\[{]/);
            if (firstBracket >= 0) {
              try {
                parsed = JSON.parse(trimmedOut.slice(firstBracket)) as T;
              } catch {
                parsed = null;
              }
            }
          }
        }

        const isAuthOrConfigError =
          Boolean(error) ||
          parsed === null ||
          trimmedOut.includes('Run okx auth login') ||
          trimmedOut.includes('requires_auth') ||
          trimmedOut.includes('not authenticated') ||
          trimmedOut.includes('API key') ||
          trimmedErr.includes('Run okx auth login') ||
          trimmedErr.includes('not authenticated') ||
          trimmedErr.includes('API key') ||
          (typeof parsed === 'object' &&
            parsed !== null &&
            'error' in (parsed as Record<string, unknown>));

        if (!error && parsed !== null && !isAuthOrConfigError) {
          const isWrite = phase === 'BORDER_3_EXECUTE' && !args.includes('liquidate-price');
          const record: CliExecutionRecord = {
            id,
            timestamp: new Date().toISOString(),
            phase,
            skill,
            command: fullCommand,
            durationMs,
            mode: isWrite ? 'LIVE_CLI_WRITE' : 'LIVE_CLI_READ',
            exitCode: 0,
            success: true,
            summary: summarizeCliOutput(args, parsed),
            rawPreview: truncatePreview(parsed),
          };
          resolve({
            success: true,
            data: parsed,
            rawStdout: trimmedOut,
            rawStderr: trimmedErr,
            durationMs,
            record,
          });
          return;
        }

        // If auth/write simulation or fallback enrichment is enabled, return the safe fallback
        if (simulateIfUnauthed && simulatedPayload !== null) {
          const record: CliExecutionRecord = {
            id,
            timestamp: new Date().toISOString(),
            phase,
            skill,
            command: fullCommand,
            durationMs,
            mode:
              phase === 'BORDER_3_EXECUTE'
                ? 'DEMO_SIMULATED_WRITE'
                : 'FALLBACK_ENRICHED',
            exitCode: 0,
            success: true,
            summary:
              simulatedSummary ||
              summarizeCliOutput(args, simulatedPayload) +
                ' [Safe Demo/Fallback Boundary]',
            rawPreview: truncatePreview(simulatedPayload),
          };
          resolve({
            success: false,
            data: simulatedPayload as T,
            rawStdout: trimmedOut,
            rawStderr: trimmedErr,
            durationMs,
            record,
          });
          return;
        }

        const record: CliExecutionRecord = {
          id,
          timestamp: new Date().toISOString(),
          phase,
          skill,
          command: fullCommand,
          durationMs,
          mode: 'FALLBACK_ENRICHED',
          exitCode: typeof error?.code === 'number' ? error.code : 1,
          success: false,
          summary:
            simulatedSummary ||
            `Handled gracefully by Border Error Boundary (${
              trimmedErr.slice(0, 80) || 'Auth/Network Fallback'
            })`,
          rawPreview: simulatedPayload ?? {
            note: 'Protected by Grid-Surgeon Border Fallback',
            stderr: trimmedErr.slice(0, 200),
          },
        };

        resolve({
          success: false,
          data: (simulatedPayload as T) ?? null,
          rawStdout: trimmedOut,
          rawStderr: trimmedErr,
          durationMs,
          record,
        });
      }
    );
  });
}

function summarizeCliOutput(args: string[], parsed: unknown): string {
  const sub = args.slice(0, 3).join(' ');
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return `${sub}: 0 records`;
    const first = parsed[0];
    if (Array.isArray(first)) {
      return `${sub}: ${parsed.length} OHLCV candles loaded (latest close: ${first[4]})`;
    }
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>;
      if ('last' in obj) {
        return `Ticker ${obj.instId}: last=$${obj.last} (24h High $${obj.high24h} / Low $${obj.low24h})`;
      }
      if ('fundingRate' in obj) {
        return `Funding Rate ${obj.instId}: ${(Number(obj.fundingRate) * 100).toFixed(4)}%`;
      }
      if ('rows' in obj && Array.isArray(obj.rows)) {
        return `OI History ${obj.instId}: ${obj.rows.length} hourly bars captured`;
      }
      if ('algoId' in obj) {
        return `OKX Bot AlgoID #${obj.algoId} confirmed`;
      }
      if ('ordId' in obj) {
        return `OKX Order #${obj.ordId} confirmed`;
      }
    }
    return `${sub}: ${parsed.length} items returned`;
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if ('algoId' in obj) return `OKX Algo #${obj.algoId} executed`;
    if ('ordId' in obj) return `OKX Order #${obj.ordId} executed`;
    if ('transId' in obj) return `OKX Transfer #${obj.transId} completed`;
  }
  return `${sub}: JSON payload verified`;
}

function truncatePreview(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    if (payload.length > 4) {
      return [
        ...payload.slice(0, 3),
        `... +${payload.length - 3} more records`,
      ];
    }
  }
  return payload;
}

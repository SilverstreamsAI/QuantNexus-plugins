/**
 * ResultSection Component
 *
 * PLUGIN_TICKET_016: Composition container replacing BacktestResultPanel.
 * Composes: SignalSummaryHeader + MetricSummaryRow + EquityCurveChart + TradesTable.
 *
 * States:
 * - idle: return null
 * - loading_data / generating / running: progress bar
 * - error: error message
 * - completed: full result display
 */

import React from 'react';
import { BacktestStatus, ExecutorResult, SignalChip, ExitRules, DataConfig, TimeframeDownloadStatus } from '../types';
import { SignalSummaryHeader } from './SignalSummaryHeader';
import { MetricSummaryRow } from './MetricSummaryRow';
import { EquityCurveChart } from './EquityCurveChart';
import { TradesTable } from './TradesTable';
import { TimeframeDownloadList } from './TimeframeDownloadList';

interface ResultSectionProps {
  status: BacktestStatus;
  progress: number;
  result: ExecutorResult | null;
  error: string | null;
  signals: SignalChip[];
  signalMethod: string;
  lookback: number;
  exitRules: ExitRules;
  exitMethod: string;
  dataConfig: DataConfig;
  // TICKET_077_P3: Per-timeframe download status
  timeframeStatus: TimeframeDownloadStatus[];
}

const STATUS_LABELS: Record<string, string> = {
  loading_data: 'Loading market data...',
  generating: 'Generating strategy code...',
  running: 'Running backtest...',
};

export const ResultSection: React.FC<ResultSectionProps> = ({
  status, progress, result, error,
  signals, signalMethod, lookback, exitRules, exitMethod, dataConfig,
  timeframeStatus,
}) => {
  if (status === 'idle') return null;

  // Progress state
  if (status === 'loading_data' || status === 'generating' || status === 'running') {
    const label = STATUS_LABELS[status] || 'Processing...';
    const pct = Math.min(Math.max(progress, 0), 100);

    const progressBar = (
      <div className="rounded-lg border border-color-terminal-border p-4 space-y-3"
           style={{ backgroundColor: 'rgba(10, 25, 47, 0.7)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-color-terminal-text-secondary terminal-mono">{label}</span>
          <span className="text-sm text-color-terminal-text-muted terminal-mono">{pct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#233554' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: 'var(--color-terminal-accent-primary)',
            }}
          />
        </div>
      </div>
    );

    // TICKET_077_P3: Show per-timeframe download list during loading_data phase
    if (status === 'loading_data' && timeframeStatus.length > 0) {
      return (
        <div className="space-y-3">
          <TimeframeDownloadList timeframeStatus={timeframeStatus} />
          {progressBar}
        </div>
      );
    }

    // PLUGIN_TICKET_017: Render real-time charts during running status when data exists
    if (status === 'running' && result) {
      return (
        <div className="space-y-4">
          {progressBar}
          <SignalSummaryHeader
            signals={signals}
            signalMethod={signalMethod}
            lookback={lookback}
            exitRules={exitRules}
            exitMethod={exitMethod}
            dataConfig={dataConfig}
          />
          <MetricSummaryRow metrics={result.metrics} />
          <EquityCurveChart equityCurve={result.equityCurve} />
          <TradesTable trades={result.trades} />
        </div>
      );
    }

    return progressBar;
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/50 p-4"
           style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
        <span className="text-sm text-red-400 terminal-mono">{error || 'Backtest failed'}</span>
      </div>
    );
  }

  // Completed state
  if (status === 'completed' && result) {
    return (
      <div className="space-y-4">
        <SignalSummaryHeader
          signals={signals}
          signalMethod={signalMethod}
          lookback={lookback}
          exitRules={exitRules}
          exitMethod={exitMethod}
          dataConfig={dataConfig}
        />
        <MetricSummaryRow metrics={result.metrics} />
        <EquityCurveChart equityCurve={result.equityCurve} />
        <TradesTable trades={result.trades} />
      </div>
    );
  }

  return null;
};

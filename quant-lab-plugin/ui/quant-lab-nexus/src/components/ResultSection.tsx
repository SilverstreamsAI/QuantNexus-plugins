/**
 * ResultSection Component
 *
 * PLUGIN_TICKET_016: Composition container replacing BacktestResultPanel.
 * Composes: SignalSummaryHeader + MetricSummaryRow + EquityCurveChart + TradesTable.
 *
 * TICKET_384: Progress bar removed from this component.
 * Pipeline progress is rendered at host level (QuantLabPage) via PipelineProgress component.
 *
 * States:
 * - idle: return null
 * - loading_data: timeframe download list (no progress bar)
 * - generating: null (pipeline shown at host level)
 * - running: real-time charts (Empty Structure pattern when no data yet)
 * - error: error message
 * - completed: full result display
 */

import React from 'react';
import { BacktestStatus, ExecutorResult, SignalChip, ExitRules, DataConfig, TimeframeDownloadStatus } from '../types';
import { SignalSummaryHeader } from './SignalSummaryHeader';
import { MetricSummaryRow } from './MetricSummaryRow';
import { EquityCurveChart } from './EquityCurveChart';
import { CandleChart } from './CandleChart';
import { TradesTable } from './TradesTable';
import { TimeframeDownloadList } from './TimeframeDownloadList';

interface ResultSectionProps {
  status: BacktestStatus;
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
  // TICKET_386: Progressive candle rendering (gray-to-colored)
  processedBars?: number;
  backtestTotalBars?: number;
}

/** Shared result display used by both running (real-time) and completed states */
const ResultDisplay: React.FC<{
  result: ExecutorResult;
  signals: SignalChip[];
  signalMethod: string;
  lookback: number;
  exitRules: ExitRules;
  exitMethod: string;
  dataConfig: DataConfig;
  // TICKET_386: Progressive candle rendering
  isExecuting?: boolean;
  processedBars?: number;
  backtestTotalBars?: number;
}> = ({ result, signals, signalMethod, lookback, exitRules, exitMethod, dataConfig, isExecuting, processedBars, backtestTotalBars }) => (
  <>
    <SignalSummaryHeader
      signals={signals}
      signalMethod={signalMethod}
      lookback={lookback}
      exitRules={exitRules}
      exitMethod={exitMethod}
      dataConfig={dataConfig}
    />
    <MetricSummaryRow metrics={result.metrics} />
    <EquityCurveChart
      equityCurve={result.equityCurve}
      isExecuting={isExecuting}
      processedBars={processedBars}
      backtestTotalBars={backtestTotalBars}
    />
    <CandleChart
      candles={result.candles}
      trades={result.trades}
      isExecuting={isExecuting}
      processedBars={processedBars}
      backtestTotalBars={backtestTotalBars}
    />
    <TradesTable trades={result.trades} />
  </>
);

export const ResultSection: React.FC<ResultSectionProps> = ({
  status, result, error,
  signals, signalMethod, lookback, exitRules, exitMethod, dataConfig,
  timeframeStatus,
  processedBars, backtestTotalBars,
}) => {
  if (status === 'idle') return null;

  // TICKET_077_P3: Show per-timeframe download list during loading_data phase
  if (status === 'loading_data' && timeframeStatus.length > 0) {
    return <TimeframeDownloadList timeframeStatus={timeframeStatus} />;
  }

  // TICKET_384: Empty Structure pattern - show empty charts with spinners during pre-data phases
  if (status === 'generating' || status === 'loading_data') {
    return (
      <div className="space-y-4">
        <EquityCurveChart equityCurve={[]} isExecuting />
        <CandleChart candles={[]} trades={[]} isExecuting />
      </div>
    );
  }

  // PLUGIN_TICKET_017: Render real-time charts during running status when data exists
  if (status === 'running') {
    if (!result) {
      // TICKET_384: Empty Structure pattern - empty charts with spinners before first INCREMENT
      return (
        <div className="space-y-4">
          <EquityCurveChart equityCurve={[]} isExecuting />
          <CandleChart candles={[]} trades={[]} isExecuting />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <ResultDisplay
          result={result}
          signals={signals} signalMethod={signalMethod} lookback={lookback}
          exitRules={exitRules} exitMethod={exitMethod} dataConfig={dataConfig}
          isExecuting
          processedBars={processedBars}
          backtestTotalBars={backtestTotalBars}
        />
      </div>
    );
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
        <ResultDisplay
          result={result}
          signals={signals} signalMethod={signalMethod} lookback={lookback}
          exitRules={exitRules} exitMethod={exitMethod} dataConfig={dataConfig}
        />
      </div>
    );
  }

  return null;
};

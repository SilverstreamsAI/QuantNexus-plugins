/**
 * MetricSummaryRow Component
 *
 * PLUGIN_TICKET_016: 6 metric cards in a grid row.
 * Adapted from BacktestResultPanel MetricCard pattern.
 */

import React from 'react';
import { ExecutorMetrics } from '../types';
import { formatCurrency, formatPercent, formatRatio, getColorClass, safeNum } from '../utils/format-utils';

interface MetricSummaryRowProps {
  metrics: ExecutorMetrics;
}

const MetricCard: React.FC<{ label: string; value: string; color?: string }> = ({
  label, value, color,
}) => (
  <div className="flex flex-col items-center p-3 rounded border border-color-terminal-border"
       style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
    <span className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
      {label}
    </span>
    <span className={`text-lg font-medium terminal-mono ${color || 'text-color-terminal-text-primary'}`}>
      {value}
    </span>
  </div>
);

export const MetricSummaryRow: React.FC<MetricSummaryRowProps> = ({ metrics }) => {
  const totalPnl = safeNum(metrics.totalPnl);
  const totalReturn = safeNum(metrics.totalReturn);
  const sharpe = safeNum(metrics.sharpeRatio);
  const maxDD = safeNum(metrics.maxDrawdown);
  const winRate = safeNum(metrics.winRate);
  const totalTrades = safeNum(metrics.totalTrades);

  return (
    <div className="grid grid-cols-6 gap-3">
      <MetricCard label="Total PnL" value={formatCurrency(totalPnl)} color={getColorClass(totalPnl)} />
      <MetricCard label="Return" value={formatPercent(totalReturn)} color={getColorClass(totalReturn)} />
      <MetricCard label="Sharpe" value={formatRatio(sharpe)} />
      <MetricCard label="Max DD" value={formatPercent(maxDD)} color="text-red-400" />
      <MetricCard label="Win Rate" value={formatPercent(winRate)} />
      <MetricCard label="Trades" value={String(totalTrades)} />
    </div>
  );
};

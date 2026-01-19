/**
 * BacktestResultPanel Component (component9)
 *
 * TICKET_152: Backtest Result Display
 * TICKET_077: Silverstream UI Component Library
 *
 * Displays backtest results with Performance/Trades/EquityCurve tabs.
 * Uses ExecutorResult from V3 architecture.
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types (matching ExecutorResult from useExecutor hook)
// -----------------------------------------------------------------------------

export interface ExecutorMetrics {
  totalPnl: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
}

export interface ExecutorTrade {
  entryTime: number;
  exitTime: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  commission: number;
  reason: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

export interface ExecutorResult {
  success: boolean;
  errorMessage?: string;
  startTime: number;
  endTime: number;
  executionTimeMs: number;
  metrics: ExecutorMetrics;
  equityCurve: EquityPoint[];
  trades: ExecutorTrade[];
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const BarChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const ListIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const TrendingUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

// -----------------------------------------------------------------------------
// Metric Card Component
// -----------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: string;
  colorClass?: string;
  highlighted?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, colorClass = 'text-color-terminal-text', highlighted = false }) => (
  <div className={cn(
    'p-3 rounded border border-color-terminal-border',
    highlighted ? 'bg-color-terminal-surface' : 'bg-color-terminal-panel/30'
  )}>
    <div className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted mb-1">
      {label}
    </div>
    <div className={cn('text-lg font-bold tabular-nums', colorClass)}>
      {value}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Format Utilities
// -----------------------------------------------------------------------------

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '$0.00';
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value == null) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const formatRatio = (value: number | null | undefined): string => {
  if (value == null) return '0.00';
  return value.toFixed(2);
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getColorClass = (value: number | null | undefined): string => {
  if (value == null) return 'text-color-terminal-text';
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-color-terminal-text';
};

// Safe number getter with default
const safeNum = (value: number | null | undefined, defaultVal = 0): number => {
  return value ?? defaultVal;
};

// -----------------------------------------------------------------------------
// Performance Tab
// -----------------------------------------------------------------------------

interface PerformanceTabProps {
  metrics: ExecutorMetrics;
  executionTimeMs: number;
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({ metrics, executionTimeMs }) => (
  <div className="p-4 space-y-4 overflow-y-auto">
    {/* Key Metrics */}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <MetricCard
        label="Total P&L"
        value={formatCurrency(metrics.totalPnl)}
        colorClass={getColorClass(metrics.totalPnl)}
        highlighted
      />
      <MetricCard
        label="Total Return"
        value={formatPercent(metrics.totalReturn)}
        colorClass={getColorClass(metrics.totalReturn)}
        highlighted
      />
      <MetricCard
        label="Sharpe Ratio"
        value={formatRatio(metrics.sharpeRatio)}
        colorClass={safeNum(metrics.sharpeRatio) >= 1 ? 'text-green-400' : safeNum(metrics.sharpeRatio) >= 0 ? 'text-yellow-400' : 'text-red-400'}
        highlighted
      />
    </div>

    {/* Risk Metrics */}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <MetricCard
        label="Max Drawdown"
        value={formatPercent(-Math.abs(safeNum(metrics.maxDrawdown)))}
        colorClass="text-red-400"
      />
      <MetricCard
        label="Win Rate"
        value={formatPercent(metrics.winRate)}
        colorClass={safeNum(metrics.winRate) >= 50 ? 'text-green-400' : 'text-yellow-400'}
      />
      <MetricCard
        label="Profit Factor"
        value={formatRatio(metrics.profitFactor)}
        colorClass={safeNum(metrics.profitFactor) >= 1.5 ? 'text-green-400' : safeNum(metrics.profitFactor) >= 1 ? 'text-yellow-400' : 'text-red-400'}
      />
    </div>

    {/* Trade Statistics */}
    <div className="grid grid-cols-3 gap-3">
      <MetricCard
        label="Total Trades"
        value={safeNum(metrics.totalTrades).toString()}
      />
      <MetricCard
        label="Winning Trades"
        value={safeNum(metrics.winningTrades).toString()}
        colorClass="text-green-400"
      />
      <MetricCard
        label="Losing Trades"
        value={safeNum(metrics.losingTrades).toString()}
        colorClass="text-red-400"
      />
    </div>

    {/* Execution Info */}
    <div className="text-xs text-color-terminal-text-muted">
      Execution time: {(safeNum(executionTimeMs) / 1000).toFixed(2)}s
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Trades Tab
// -----------------------------------------------------------------------------

interface TradesTabProps {
  trades: ExecutorTrade[];
}

const TradesTab: React.FC<TradesTabProps> = ({ trades }) => (
  <div className="p-4 overflow-auto">
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-color-terminal-border text-left">
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">#</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Entry Time</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Exit Time</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Side</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Entry</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Exit</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Qty</th>
            <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {(trades || []).slice(0, 100).map((trade, index) => (
            <tr key={index} className="border-b border-color-terminal-border/50 hover:bg-color-terminal-surface/30">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{index + 1}</td>
              <td className="py-2 pr-4 text-color-terminal-text tabular-nums">{formatDate(safeNum(trade.entryTime))}</td>
              <td className="py-2 pr-4 text-color-terminal-text tabular-nums">{formatDate(safeNum(trade.exitTime))}</td>
              <td className={cn('py-2 pr-4 font-medium', trade.side === 'BUY' ? 'text-green-400' : 'text-red-400')}>
                {trade.side || '-'}
              </td>
              <td className="py-2 pr-4 text-right text-color-terminal-text tabular-nums">
                ${safeNum(trade.entryPrice).toFixed(2)}
              </td>
              <td className="py-2 pr-4 text-right text-color-terminal-text tabular-nums">
                ${safeNum(trade.exitPrice).toFixed(2)}
              </td>
              <td className="py-2 pr-4 text-right text-color-terminal-text tabular-nums">
                {safeNum(trade.quantity).toFixed(4)}
              </td>
              <td className={cn('py-2 pr-4 text-right font-medium tabular-nums', getColorClass(trade.pnl))}>
                {formatCurrency(trade.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(trades?.length || 0) > 100 && (
        <div className="mt-2 text-xs text-color-terminal-text-muted">
          Showing 100 of {trades?.length || 0} trades
        </div>
      )}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Equity Curve Tab (Simple)
// -----------------------------------------------------------------------------

interface EquityCurveTabProps {
  equityCurve: EquityPoint[];
}

const EquityCurveTab: React.FC<EquityCurveTabProps> = ({ equityCurve }) => {
  if (!equityCurve || equityCurve.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center h-64 text-color-terminal-text-muted">
        No equity curve data available
      </div>
    );
  }

  const minEquity = Math.min(...equityCurve.map(p => p.equity));
  const maxEquity = Math.max(...equityCurve.map(p => p.equity));
  const range = maxEquity - minEquity || 1;

  // Simple SVG line chart
  const width = 100;
  const height = 40;
  const points = equityCurve.map((point, index) => {
    const x = (index / (equityCurve.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const startEquity = equityCurve[0]?.equity || 0;
  const endEquity = equityCurve[equityCurve.length - 1]?.equity || 0;
  const pnl = endEquity - startEquity;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Starting Equity"
          value={`$${startEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        />
        <MetricCard
          label="Ending Equity"
          value={`$${endEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          colorClass={getColorClass(pnl)}
        />
        <MetricCard
          label="Net Change"
          value={formatCurrency(pnl)}
          colorClass={getColorClass(pnl)}
          highlighted
        />
      </div>

      {/* Simple Chart */}
      <div className="border border-color-terminal-border rounded p-4 bg-color-terminal-panel/30">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={pnl >= 0 ? '#4ade80' : '#f87171'}
            strokeWidth="0.5"
            points={points}
          />
        </svg>
        <div className="flex justify-between text-[10px] text-color-terminal-text-muted mt-2">
          <span>{formatDate(equityCurve[0]?.timestamp || 0)}</span>
          <span>{formatDate(equityCurve[equityCurve.length - 1]?.timestamp || 0)}</span>
        </div>
      </div>

      {/* Data Points */}
      <div className="text-xs text-color-terminal-text-muted">
        {equityCurve.length} data points
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

type TabId = 'performance' | 'trades' | 'equity';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'performance', label: 'PERFORMANCE', icon: <BarChartIcon className="w-4 h-4" /> },
  { id: 'trades', label: 'TRADES', icon: <ListIcon className="w-4 h-4" /> },
  { id: 'equity', label: 'EQUITY CURVE', icon: <TrendingUpIcon className="w-4 h-4" /> },
];

export interface BacktestResultPanelProps {
  result: ExecutorResult;
  className?: string;
}

export const BacktestResultPanel: React.FC<BacktestResultPanelProps> = ({
  result,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('performance');

  return (
    <div className={cn('flex flex-col h-full border border-color-terminal-border rounded-lg bg-color-terminal-panel/30', className)}>
      {/* Tab Header */}
      <div className="flex border-b border-color-terminal-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-color-terminal-accent-gold text-color-terminal-accent-gold'
                : 'border-transparent text-color-terminal-text-muted hover:text-color-terminal-text'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'performance' && (
          <PerformanceTab metrics={result.metrics} executionTimeMs={result.executionTimeMs} />
        )}
        {activeTab === 'trades' && (
          <TradesTab trades={result.trades} />
        )}
        {activeTab === 'equity' && (
          <EquityCurveTab equityCurve={result.equityCurve} />
        )}
      </div>
    </div>
  );
};

export default BacktestResultPanel;

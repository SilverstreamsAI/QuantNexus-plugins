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

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  candles: Candle[];
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

const CandleChartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5v14" />
    <rect x="5" y="8" width="8" height="8" rx="1" />
    <path d="M15 3v18" />
    <rect x="11" y="6" width="8" height="6" rx="1" />
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
  if (value == null || !Number.isFinite(value)) return '$0.00';
  // Cap display at reasonable range
  const capped = Math.max(-1e12, Math.min(1e12, value));
  const sign = capped >= 0 ? '+' : '';
  return `${sign}$${Math.abs(capped).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '0.00%';
  // Cap display at reasonable range
  const capped = Math.max(-9999, Math.min(9999, value));
  const sign = capped >= 0 ? '+' : '';
  return `${sign}${capped.toFixed(2)}%`;
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
// Charts Tab (Dual-Chart: Equity + K-Line)
// -----------------------------------------------------------------------------

interface ChartsTabProps {
  equityCurve: EquityPoint[];
  candles: Candle[];
  trades: ExecutorTrade[];
}

const ChartsTab: React.FC<ChartsTabProps> = ({ equityCurve, candles, trades }) => {
  // Equity curve chart dimensions
  const equityHeight = 180;
  const klineHeight = 220;

  // Equity curve rendering
  const renderEquityCurve = () => {
    if (!equityCurve || equityCurve.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
          No equity data
        </div>
      );
    }

    // TICKET_154: Filter out invalid equity values (NaN, Infinity, overflow)
    const validEquityCurve = equityCurve.filter(p =>
      Number.isFinite(p.equity) && Math.abs(p.equity) < 1e15
    );

    // TICKET_155: Need at least 2 points to render a line (avoid division by zero)
    if (validEquityCurve.length < 2) {
      return (
        <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
          Processing... ({validEquityCurve.length} points)
        </div>
      );
    }

    const minEquity = Math.min(...validEquityCurve.map(p => p.equity)) * 0.98;
    const maxEquity = Math.max(...validEquityCurve.map(p => p.equity)) * 1.02;
    const range = maxEquity - minEquity || 1;

    const width = 100;
    const height = 100;
    const pointCount = validEquityCurve.length;

    // Equity line (using filtered valid data)
    const equityPoints = validEquityCurve.map((point, index) => {
      const x = (index / (pointCount - 1)) * width;
      const y = height - ((point.equity - minEquity) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    // Area fill
    const areaPath = `M 0,${height} ` + validEquityCurve.map((point, index) => {
      const x = (index / (pointCount - 1)) * width;
      const y = height - ((point.equity - minEquity) / range) * height;
      return `L ${x},${y}`;
    }).join(' ') + ` L ${width},${height} Z`;

    const startEquity = validEquityCurve[0]?.equity || 0;
    const endEquity = validEquityCurve[validEquityCurve.length - 1]?.equity || 0;
    const pnl = endEquity - startEquity;
    const color = pnl >= 0 ? '#4ade80' : '#f87171';

    return (
      <>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-color-terminal-border/50">
          <span className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted">
            Equity Curve
          </span>
          <span className={cn('text-xs tabular-nums font-medium', pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            {formatCurrency(endEquity)} ({formatPercent(startEquity > 0 ? (pnl / startEquity) * 100 : 0)})
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: equityHeight - 32 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#equityGrad)" />
          <polyline fill="none" stroke={color} strokeWidth="0.3" points={equityPoints} />
        </svg>
      </>
    );
  };

  // K-line chart rendering
  const renderKLineChart = () => {
    if (!candles || candles.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
          No K-line data
        </div>
      );
    }

    const viewWidth = 100;
    const viewHeight = 100;
    const margin = { top: 5, bottom: 15 };
    const chartHeight = viewHeight - margin.top - margin.bottom;

    const minPrice = Math.min(...candles.map(c => c.low)) * 0.998;
    const maxPrice = Math.max(...candles.map(c => c.high)) * 1.002;
    const priceRange = maxPrice - minPrice || 1;

    const candleWidth = viewWidth / candles.length;
    const bodyWidth = candleWidth * 0.7;

    const priceToY = (price: number) => margin.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

    return (
      <>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-color-terminal-border/50">
          <span className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted">
            K-Line Chart
          </span>
          <span className="text-[10px] text-color-terminal-text-muted tabular-nums">
            {candles.length} bars
          </span>
        </div>
        <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="w-full" style={{ height: klineHeight - 32 }} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line
              key={i}
              x1={0}
              x2={viewWidth}
              y1={margin.top + chartHeight * ratio}
              y2={margin.top + chartHeight * ratio}
              stroke="#374151"
              strokeOpacity={0.3}
              strokeDasharray="0.5,1"
            />
          ))}

          {/* Candles */}
          {candles.map((candle, i) => {
            const x = i * candleWidth + candleWidth / 2;
            const isUp = candle.close >= candle.open;
            const color = isUp ? '#22C55E' : '#EF4444';
            const bodyTop = priceToY(Math.max(candle.open, candle.close));
            const bodyBottom = priceToY(Math.min(candle.open, candle.close));
            const bodyH = Math.max(0.3, bodyBottom - bodyTop);

            return (
              <g key={i}>
                {/* Wick */}
                <line
                  x1={x}
                  x2={x}
                  y1={priceToY(candle.high)}
                  y2={priceToY(candle.low)}
                  stroke={color}
                  strokeWidth={0.1}
                />
                {/* Body */}
                <rect
                  x={x - bodyWidth / 2}
                  y={bodyTop}
                  width={bodyWidth}
                  height={bodyH}
                  fill={color}
                />
              </g>
            );
          })}

          {/* Trade markers */}
          {trades.slice(0, 50).map((trade, i) => {
            const tradeTime = trade.entryTime * 1000;
            const candleIndex = candles.findIndex((c, idx) =>
              c.timestamp <= tradeTime && (idx === candles.length - 1 || candles[idx + 1].timestamp > tradeTime)
            );
            if (candleIndex < 0) return null;

            const x = candleIndex * candleWidth + candleWidth / 2;
            const y = priceToY(trade.entryPrice);
            const isBuy = trade.side.toLowerCase().includes('buy');

            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={0.8}
                fill={isBuy ? '#22C55E' : '#EF4444'}
                stroke="#fff"
                strokeWidth={0.15}
              />
            );
          })}

          {/* Price labels */}
          <text x={viewWidth - 1} y={margin.top + 2} className="text-[2px] fill-color-terminal-text-muted" textAnchor="end">
            {maxPrice.toFixed(0)}
          </text>
          <text x={viewWidth - 1} y={viewHeight - margin.bottom - 1} className="text-[2px] fill-color-terminal-text-muted" textAnchor="end">
            {minPrice.toFixed(0)}
          </text>
        </svg>
      </>
    );
  };

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Equity Curve */}
      <div className="border border-color-terminal-border rounded bg-color-terminal-panel/30" style={{ height: equityHeight }}>
        {renderEquityCurve()}
      </div>

      {/* K-Line Chart */}
      <div className="border border-color-terminal-border rounded bg-color-terminal-panel/30" style={{ height: klineHeight }}>
        {renderKLineChart()}
      </div>

      {/* Summary */}
      <div className="text-[10px] text-color-terminal-text-muted flex justify-between">
        <span>Equity: {equityCurve?.length || 0} points</span>
        <span>Candles: {candles?.length || 0} bars</span>
        <span>Trades: {trades?.length || 0}</span>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

type TabId = 'performance' | 'trades' | 'charts';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: 'performance', label: 'PERFORMANCE', icon: <BarChartIcon className="w-4 h-4" /> },
  { id: 'trades', label: 'TRADES', icon: <ListIcon className="w-4 h-4" /> },
  { id: 'charts', label: 'CHARTS', icon: <CandleChartIcon className="w-4 h-4" /> },
];

export interface BacktestResultPanelProps {
  result: ExecutorResult;
  className?: string;
}

export const BacktestResultPanel: React.FC<BacktestResultPanelProps> = ({
  result,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('charts');

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
        {activeTab === 'charts' && (
          <ChartsTab
            equityCurve={result.equityCurve}
            candles={result.candles || []}
            trades={result.trades}
          />
        )}
      </div>
    </div>
  );
};

export default BacktestResultPanel;

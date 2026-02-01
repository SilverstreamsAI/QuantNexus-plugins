/**
 * BacktestResultPanel Component (component9)
 *
 * TICKET_152: Backtest Result Display
 * TICKET_077: Silverstream UI Component Library
 *
 * Displays backtest results with Performance/Trades/EquityCurve tabs.
 * Uses ExecutorResult from V3 architecture.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { getCandleColor, isCandleProcessed, CANDLE_COLOR_UNPROCESSED } from '../../utils/chart-utils';

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

// TICKET_151_2: BarChartIcon removed - Performance tab removed

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

// TICKET_151_2: MetricCard removed - Performance tab removed, metrics now in Compare tab only

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
// TICKET_151_2: Performance Tab removed - metrics now in Compare tab only
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Trades Tab (TICKET_151_2: Vertical stacking like Charts tab)
// -----------------------------------------------------------------------------

interface TradesTabProps {
  results: ExecutorResult[];
  currentCaseIndex?: number;
  isExecuting?: boolean;
  totalCases?: number;
  scrollToCaseRef?: React.MutableRefObject<((index: number) => void) | null>;
}

// Single case trades table
const SingleCaseTrades: React.FC<{ trades: ExecutorTrade[] }> = ({ trades }) => {
  const { t } = useTranslation('backtest');
  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-color-terminal-border text-left">
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">{t('resultPanel.tradesTable.index')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">{t('resultPanel.tradesTable.entryTime')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">{t('resultPanel.tradesTable.exitTime')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">{t('resultPanel.tradesTable.side')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">{t('resultPanel.tradesTable.entry')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">{t('resultPanel.tradesTable.exit')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">{t('resultPanel.tradesTable.qty')}</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">{t('resultPanel.tradesTable.pnl')}</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 100).map((trade, index) => (
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
        {trades.length > 100 && (
          <div className="mt-2 text-xs text-color-terminal-text-muted">
            {t('resultPanel.tradesTable.showingOf', { shown: 100, total: trades.length })}
          </div>
        )}
        {trades.length === 0 && (
          <div className="py-8 text-center text-xs text-color-terminal-text-muted">
            {t('resultPanel.tradesTable.noTrades')}
          </div>
        )}
      </div>
    </div>
  );
};

const TradesTab: React.FC<TradesTabProps> = ({ results, currentCaseIndex, isExecuting, totalCases = 0, scrollToCaseRef }) => {
  const { t } = useTranslation('backtest');
  const containerRef = useRef<HTMLDivElement>(null);
  const caseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Determine how many case sections to render (same logic as ChartsTab)
  const casesToRender = isExecuting && totalCases > 0 ? totalCases : results.length;

  // Auto-scroll to current case during execution
  useEffect(() => {
    if (currentCaseIndex && currentCaseIndex > 0 && isExecuting) {
      const targetRef = caseRefs.current[currentCaseIndex - 1];
      targetRef?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentCaseIndex, isExecuting]);

  // Expose scroll function to parent for case selection from History panel
  useEffect(() => {
    if (scrollToCaseRef) {
      scrollToCaseRef.current = (index: number) => {
        caseRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
      };
    }
  }, [scrollToCaseRef]);

  if (casesToRender === 0) {
    return (
      <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
        {t('resultPanel.status.noResults')}
      </div>
    );
  }

  // Single case and not executing multi-case: render without case header
  if (casesToRender === 1 && !isExecuting) {
    return <SingleCaseTrades trades={results[0]?.trades || []} />;
  }

  // Multiple cases: vertical stacking with case headers
  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {Array.from({ length: casesToRender }).map((_, index) => {
        const result = results[index];
        const hasResult = !!result;
        const isCurrentCase = isExecuting && currentCaseIndex === index + 1;
        const isPending = isExecuting && currentCaseIndex !== undefined && index + 1 > currentCaseIndex;

        return (
          <div
            key={index}
            ref={el => caseRefs.current[index] = el}
            className="min-h-full border-b border-color-terminal-border last:border-b-0"
          >
            {/* Case Header */}
            <div className="px-4 py-2 bg-color-terminal-panel/50 border-b border-color-terminal-border sticky top-0 z-10">
              <span className={cn(
                'text-xs font-bold uppercase',
                hasResult ? 'text-green-400' : isCurrentCase ? 'text-yellow-400' : 'text-color-terminal-text-secondary'
              )}>
                {t('resultPanel.status.case', { index: index + 1 })}
                {isCurrentCase && t('resultPanel.status.testing')}
                {isPending && t('resultPanel.status.pending')}
              </span>
              {hasResult && result.metrics && (
                <span className={cn(
                  'ml-3 text-xs tabular-nums',
                  result.metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {result.metrics.totalPnl >= 0 ? '+' : ''}{result.metrics.totalPnl?.toFixed(2) || '0.00'}
                </span>
              )}
              {hasResult && (
                <span className="ml-3 text-xs text-color-terminal-text-muted">
                  {t('resultPanel.status.tradesCount', { count: result.trades?.length || 0 })}
                </span>
              )}
            </div>

            {/* Trades for this case */}
            {hasResult ? (
              <SingleCaseTrades trades={result.trades} />
            ) : (
              <div className="flex items-center justify-center h-48 text-color-terminal-text-muted text-xs">
                {isCurrentCase ? t('resultPanel.status.collectingData') : t('resultPanel.status.waiting')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// TICKET_234_3: Status Indicator Icons
// -----------------------------------------------------------------------------

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
);

const CheckmarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

// -----------------------------------------------------------------------------
// Single Case Charts (Dual-Chart: Equity + K-Line) - TICKET_151_1
// -----------------------------------------------------------------------------

interface SingleCaseChartsProps {
  equityCurve: EquityPoint[];
  candles: Candle[];
  trades: ExecutorTrade[];
  /** TICKET_231: Number of bars processed for gray-to-color transition */
  processedBars?: number;
  /** TICKET_231: Total bars in backtest */
  backtestTotalBars?: number;
  /** TICKET_234_3: Whether backtest is currently executing */
  isExecuting?: boolean;
}

const SingleCaseCharts: React.FC<SingleCaseChartsProps> = ({
  equityCurve,
  candles,
  trades,
  processedBars = 0,
  backtestTotalBars = 0,
  isExecuting = false,
}) => {
  const { t } = useTranslation('backtest');

  // TICKET_231: Debug sync values
  const isBacktestInProgress = backtestTotalBars > 0 && processedBars > 0 && processedBars < backtestTotalBars;
  console.debug('[TICKET_231] SingleCaseCharts render:', {
    processedBars,
    backtestTotalBars,
    isBacktestInProgress,
    equityCurveLength: equityCurve?.length,
    candlesLength: candles?.length,
  });

  // Equity curve chart dimensions
  const equityHeight = 180;
  const klineHeight = 220;

  // Equity curve rendering
  const renderEquityCurve = () => {
    // TICKET_234_3: Show status indicator when no equity data
    if (!equityCurve || equityCurve.length === 0) {
      if (isExecuting) {
        // Testing in progress - show spinner only
        return (
          <div className="flex items-center justify-center h-full">
            <SpinnerIcon className="w-8 h-8 text-color-terminal-accent-teal" />
          </div>
        );
      } else {
        // Completed with no trades - show checkmark only
        return (
          <div className="flex items-center justify-center h-full">
            <CheckmarkIcon className="w-8 h-8 text-color-terminal-accent-gold" />
          </div>
        );
      }
    }

    // TICKET_154: Filter out invalid equity values (NaN, Infinity, overflow)
    const validEquityCurve = equityCurve.filter(p =>
      Number.isFinite(p.equity) && Math.abs(p.equity) < 1e15
    );

    // TICKET_231: Limit equity display to processedBars for synchronized display
    // When backtest is in progress, limit to min(processedBars, equityCurve.length)
    // This keeps equity curve in sync with K-LINE processed bar indicator
    const displayLimit = isBacktestInProgress
      ? Math.min(processedBars, validEquityCurve.length)
      : validEquityCurve.length;
    const displayEquityCurve = validEquityCurve.slice(0, displayLimit);

    // TICKET_155: Need at least 2 points to render a line (avoid division by zero)
    if (displayEquityCurve.length < 2) {
      return (
        <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
          {t('resultPanel.charts.processing', { count: displayEquityCurve.length })}
        </div>
      );
    }

    const minEquity = Math.min(...displayEquityCurve.map(p => p.equity)) * 0.98;
    const maxEquity = Math.max(...displayEquityCurve.map(p => p.equity)) * 1.02;
    const range = maxEquity - minEquity || 1;

    const width = 100;
    const height = 100;
    // TICKET_231: Use candles.length as X-axis reference to sync with K-LINE chart
    // This ensures equity curve only spans the same X range as processed candles
    const totalXPoints = candles?.length || displayEquityCurve.length;

    // Equity line (using filtered and limited data)
    const equityPoints = displayEquityCurve.map((point, index) => {
      const x = (index / (totalXPoints - 1)) * width;
      const y = height - ((point.equity - minEquity) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    // Area fill
    const areaPath = `M 0,${height} ` + displayEquityCurve.map((point, index) => {
      const x = (index / (totalXPoints - 1)) * width;
      const y = height - ((point.equity - minEquity) / range) * height;
      return `L ${x},${y}`;
    }).join(' ') + ` L ${(displayEquityCurve.length - 1) / (totalXPoints - 1) * width},${height} Z`;

    const startEquity = displayEquityCurve[0]?.equity || 0;
    const endEquity = displayEquityCurve[displayEquityCurve.length - 1]?.equity || 0;
    const pnl = endEquity - startEquity;
    const color = pnl >= 0 ? '#4ade80' : '#f87171';

    return (
      <>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-color-terminal-border/50">
          <span className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted">
            {t('resultPanel.charts.equityCurve')}
          </span>
          <span className={cn('text-xs tabular-nums font-medium', pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
            ${endEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({formatPercent(startEquity > 0 ? (pnl / startEquity) * 100 : 0)})
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
          {t('resultPanel.charts.noKlineData')}
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
            {t('resultPanel.charts.klineChart')}
          </span>
          <span className="text-[10px] text-color-terminal-text-muted tabular-nums">
            {t('resultPanel.charts.bars', { count: candles.length })}
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

          {/* Candles - TICKET_231: Gray-to-color transition based on processedBars */}
          {candles.map((candle, i) => {
            const x = i * candleWidth + candleWidth / 2;
            const isUp = candle.close >= candle.open;
            // TICKET_231: Use centralized color logic for gray-to-color transition
            const isProcessed = isCandleProcessed(i, processedBars, backtestTotalBars);
            const color = getCandleColor(isUp, isProcessed);
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

          {/* Trade markers - evenly sampled across all trades */}
          {trades
            .filter((_, idx) => idx % Math.max(1, Math.ceil(trades.length / 50)) === 0)
            .slice(0, 50)
            .map((trade, i) => {
            const tradeTime = trade.entryTime;
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
        <span>{t('resultPanel.summary.equity', { count: equityCurve?.length || 0 })}</span>
        <span>{t('resultPanel.summary.candles', { count: candles?.length || 0 })}</span>
        <span>{t('resultPanel.summary.trades', { count: trades?.length || 0 })}</span>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// TICKET_151_1: Charts Tab with Multi-Case Vertical Stacking
// -----------------------------------------------------------------------------

interface ChartsTabProps {
  results: ExecutorResult[];
  currentCaseIndex?: number;
  isExecuting?: boolean;
  totalCases?: number;
  scrollToCaseRef?: React.MutableRefObject<((index: number) => void) | null>;
  /** TICKET_231: Number of bars processed for gray-to-color transition */
  processedBars?: number;
  /** TICKET_231: Total bars in backtest */
  backtestTotalBars?: number;
}

const ChartsTab: React.FC<ChartsTabProps> = ({
  results,
  currentCaseIndex,
  isExecuting,
  totalCases = 0,
  scrollToCaseRef,
  processedBars = 0,
  backtestTotalBars = 0,
}) => {
  const { t } = useTranslation('backtest');
  const containerRef = useRef<HTMLDivElement>(null);
  const caseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Determine how many case sections to render
  // Use totalCases during execution, otherwise use results.length
  const casesToRender = isExecuting && totalCases > 0 ? totalCases : results.length;

  // Auto-scroll to current case during execution
  useEffect(() => {
    if (currentCaseIndex && currentCaseIndex > 0 && isExecuting) {
      const targetRef = caseRefs.current[currentCaseIndex - 1];
      targetRef?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentCaseIndex, isExecuting]);

  // Expose scroll function to parent for case selection from History panel
  useEffect(() => {
    if (scrollToCaseRef) {
      scrollToCaseRef.current = (index: number) => {
        caseRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
      };
    }
  }, [scrollToCaseRef]);

  if (casesToRender === 0) {
    return (
      <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
        {t('resultPanel.status.noResults')}
      </div>
    );
  }

  // Single case and not executing multi-case: render without case header
  if (casesToRender === 1 && !isExecuting) {
    return (
      <SingleCaseCharts
        equityCurve={results[0]?.equityCurve || []}
        candles={results[0]?.candles || []}
        trades={results[0]?.trades || []}
        processedBars={processedBars}
        backtestTotalBars={backtestTotalBars}
        isExecuting={false}
      />
    );
  }

  // Multiple cases: vertical stacking with case headers
  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {Array.from({ length: casesToRender }).map((_, index) => {
        const result = results[index];
        const hasResult = !!result;
        const isCurrentCase = isExecuting && currentCaseIndex === index + 1;
        const isPending = isExecuting && currentCaseIndex !== undefined && index + 1 > currentCaseIndex;

        return (
          <div
            key={index}
            ref={el => caseRefs.current[index] = el}
            className="min-h-full border-b border-color-terminal-border last:border-b-0"
          >
            {/* Case Header */}
            <div className="px-4 py-2 bg-color-terminal-panel/50 border-b border-color-terminal-border sticky top-0 z-10">
              <span className={cn(
                'text-xs font-bold uppercase',
                hasResult ? 'text-green-400' : isCurrentCase ? 'text-yellow-400' : 'text-color-terminal-text-secondary'
              )}>
                {t('resultPanel.status.case', { index: index + 1 })}
                {isCurrentCase && t('resultPanel.status.testing')}
                {isPending && t('resultPanel.status.pending')}
              </span>
              {hasResult && result.metrics && (
                <span className={cn(
                  'ml-3 text-xs tabular-nums',
                  result.metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {result.metrics.totalPnl >= 0 ? '+' : ''}{result.metrics.totalPnl?.toFixed(2) || '0.00'}
                </span>
              )}
            </div>

            {/* Charts for this case */}
            {hasResult ? (
              <SingleCaseCharts
                equityCurve={result.equityCurve}
                candles={result.candles || []}
                trades={result.trades}
                processedBars={processedBars}
                backtestTotalBars={backtestTotalBars}
                isExecuting={isCurrentCase}
              />
            ) : (
              <div className="flex items-center justify-center h-96 text-color-terminal-text-muted text-xs">
                {isCurrentCase ? t('resultPanel.status.collectingData') : t('resultPanel.status.waiting')}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// TICKET_151: Comparison Tab for Multiple Results
// -----------------------------------------------------------------------------

interface ComparisonTabProps {
  results: ExecutorResult[];
}

// Color palette for multiple strategies
const STRATEGY_COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];

const ComparisonTab: React.FC<ComparisonTabProps> = ({ results }) => {
  const { t } = useTranslation('backtest');

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-color-terminal-text-muted text-xs">
        {t('resultPanel.comparison.noResults')}
      </div>
    );
  }

  // Comparison metrics table
  const renderComparisonTable = () => (
    <div className="p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted mb-3">
        {t('resultPanel.comparison.title')}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-color-terminal-border text-left">
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">{t('resultPanel.comparison.metric')}</th>
              {results.map((_, i) => (
                <th key={i} className="pb-2 pr-4 font-medium" style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}>
                  {t('resultPanel.comparison.strategy', { index: i + 1 })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.totalPnl')}</td>
              {results.map((r, i) => (
                <td key={i} className={cn('py-2 pr-4 tabular-nums font-medium', getColorClass(r.metrics.totalPnl))}>
                  {formatCurrency(r.metrics.totalPnl)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.totalReturn')}</td>
              {results.map((r, i) => (
                <td key={i} className={cn('py-2 pr-4 tabular-nums font-medium', getColorClass(r.metrics.totalReturn))}>
                  {formatPercent(r.metrics.totalReturn)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.sharpeRatio')}</td>
              {results.map((r, i) => (
                <td key={i} className="py-2 pr-4 tabular-nums">
                  {formatRatio(r.metrics.sharpeRatio)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.maxDrawdown')}</td>
              {results.map((r, i) => (
                <td key={i} className="py-2 pr-4 tabular-nums text-red-400">
                  {formatPercent(-Math.abs(safeNum(r.metrics.maxDrawdown)))}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.winRate')}</td>
              {results.map((r, i) => (
                <td key={i} className={cn('py-2 pr-4 tabular-nums', safeNum(r.metrics.winRate) >= 50 ? 'text-green-400' : 'text-yellow-400')}>
                  {formatPercent(r.metrics.winRate)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.totalTrades')}</td>
              {results.map((r, i) => (
                <td key={i} className="py-2 pr-4 tabular-nums">
                  {safeNum(r.metrics.totalTrades)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-color-terminal-border/50">
              <td className="py-2 pr-4 text-color-terminal-text-muted">{t('resultPanel.comparison.profitFactor')}</td>
              {results.map((r, i) => (
                <td key={i} className={cn('py-2 pr-4 tabular-nums', safeNum(r.metrics.profitFactor) >= 1.5 ? 'text-green-400' : safeNum(r.metrics.profitFactor) >= 1 ? 'text-yellow-400' : 'text-red-400')}>
                  {formatRatio(r.metrics.profitFactor)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // Overlay equity curves
  const renderOverlayEquityCurves = () => {
    const height = 200;
    const width = 100;

    // Find global min/max equity across all results
    let allEquities: number[] = [];
    results.forEach(r => {
      if (r.equityCurve) {
        allEquities = allEquities.concat(r.equityCurve.filter(p => Number.isFinite(p.equity)).map(p => p.equity));
      }
    });

    if (allEquities.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 text-color-terminal-text-muted text-xs">
          {t('resultPanel.charts.noEquityData')}
        </div>
      );
    }

    const minEquity = Math.min(...allEquities) * 0.98;
    const maxEquity = Math.max(...allEquities) * 1.02;
    const range = maxEquity - minEquity || 1;

    return (
      <div className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted mb-3">
          {t('resultPanel.comparison.equityOverlay')}
        </div>
        <div className="border border-color-terminal-border rounded bg-color-terminal-panel/30" style={{ height }}>
          <svg viewBox={`0 0 ${width} 100`} className="w-full h-full" preserveAspectRatio="none">
            {results.map((r, resultIdx) => {
              const validCurve = (r.equityCurve || []).filter(p => Number.isFinite(p.equity));
              if (validCurve.length < 2) return null;

              const points = validCurve.map((point, idx) => {
                const x = (idx / (validCurve.length - 1)) * width;
                const y = 100 - ((point.equity - minEquity) / range) * 100;
                return `${x},${y}`;
              }).join(' ');

              return (
                <polyline
                  key={resultIdx}
                  fill="none"
                  stroke={STRATEGY_COLORS[resultIdx % STRATEGY_COLORS.length]}
                  strokeWidth="0.4"
                  points={points}
                />
              );
            })}
          </svg>
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-2">
          {results.map((_, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px]">
              <div className="w-3 h-0.5" style={{ backgroundColor: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }} />
              <span className="text-color-terminal-text-muted">{t('resultPanel.comparison.strategy', { index: i + 1 })}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto h-full">
      {renderComparisonTable()}
      {renderOverlayEquityCurves()}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

// TICKET_151_2: Simplified tabs - removed Performance (now in Compare only)
type TabId = 'charts' | 'trades' | 'comparison';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// TICKET_151: Icon for comparison view
const CompareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

// TICKET_151_2: Tab order - Charts first, then Trades
// Labels are translation keys, resolved in component
const baseTabs: Tab[] = [
  { id: 'charts', label: 'resultPanel.tabs.charts', icon: <CandleChartIcon className="w-4 h-4" /> },
  { id: 'trades', label: 'resultPanel.tabs.trades', icon: <ListIcon className="w-4 h-4" /> },
];

const comparisonTab: Tab = { id: 'comparison', label: 'resultPanel.tabs.compare', icon: <CompareIcon className="w-4 h-4" /> };

export interface BacktestResultPanelProps {
  /** TICKET_151: Support single result (legacy) or array of results for comparison */
  result?: ExecutorResult;
  results?: ExecutorResult[];
  className?: string;
  /** TICKET_151_1: Execution state for Charts stacking and Compare tab behavior */
  isExecuting?: boolean;
  currentCaseIndex?: number;
  totalCases?: number;
  onCaseSelect?: (index: number) => void;
  /** TICKET_151_1: Index to scroll to when user clicks case in History panel */
  scrollToCase?: number;
  /** TICKET_231: Number of bars processed so far (for gray-to-color transition) */
  processedBars?: number;
  /** TICKET_231: Total bars in backtest (for gray-to-color transition) */
  backtestTotalBars?: number;
}

export const BacktestResultPanel: React.FC<BacktestResultPanelProps> = ({
  result,
  results = [],
  className,
  isExecuting = false,
  currentCaseIndex = 0,
  totalCases = 0,
  onCaseSelect,
  scrollToCase,
  processedBars = 0,
  backtestTotalBars = 0,
}) => {
  const { t } = useTranslation('backtest');
  const [activeTab, setActiveTab] = useState<TabId>('charts');
  // TICKET_151_2: Refs for scrolling in both Charts and Trades tabs
  const scrollToChartsCaseRef = React.useRef<((index: number) => void) | null>(null);
  const scrollToTradesCaseRef = React.useRef<((index: number) => void) | null>(null);
  // TICKET_151_1: Track last processed scrollToCase to avoid duplicate triggers
  const lastScrollToCaseRef = useRef<number | undefined>(undefined);

  // TICKET_151_2: Scroll to case in active tab when scrollToCase prop changes (from History panel click)
  useEffect(() => {
    // Only process if scrollToCase changed and is valid
    if (scrollToCase !== undefined && scrollToCase >= 0 && scrollToCase !== lastScrollToCaseRef.current) {
      lastScrollToCaseRef.current = scrollToCase;
      // Scroll in the currently active tab
      setTimeout(() => {
        if (activeTab === 'charts') {
          scrollToChartsCaseRef.current?.(scrollToCase);
        } else if (activeTab === 'trades') {
          scrollToTradesCaseRef.current?.(scrollToCase);
        }
      }, 100);
    }
  }, [scrollToCase, activeTab]);

  // TICKET_151: Support both single result and results array
  // If results array is provided, use it; otherwise wrap single result in array
  const allResults: ExecutorResult[] = results.length > 0
    ? results
    : (result ? [result] : []);

  // If no results, show empty state
  if (allResults.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-color-terminal-text-muted">{t('resultPanel.status.noResults')}</div>
      </div>
    );
  }

  // For single result, use the original behavior
  const primaryResult = allResults[0];
  const hasMultipleResults = allResults.length > 1;

  // TICKET_151: Dynamic tabs - add comparison tab when multiple results
  const tabs = hasMultipleResults ? [comparisonTab, ...baseTabs] : baseTabs;

  // TICKET_151_1: Compare tab disabled during execution, no auto-switch
  const isCompareEnabled = !isExecuting && hasMultipleResults;
  const effectiveActiveTab = activeTab;

  return (
    <div className={cn('flex flex-col h-full border border-color-terminal-border rounded-lg bg-color-terminal-panel/30', className)}>
      {/* Tab Header */}
      <div className="flex border-b border-color-terminal-border">
        {tabs.map((tab) => {
          const isDisabled = tab.id === 'comparison' && !isCompareEnabled;
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors border-b-2',
                effectiveActiveTab === tab.id
                  ? 'border-color-terminal-accent-gold text-color-terminal-accent-gold'
                  : 'border-transparent text-color-terminal-text-muted hover:text-color-terminal-text',
                isDisabled && 'opacity-50 cursor-not-allowed hover:text-color-terminal-text-muted'
              )}
            >
              {tab.icon}
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* TICKET_151: Comparison tab for multiple results */}
        {effectiveActiveTab === 'comparison' && hasMultipleResults && (
          <ComparisonTab results={allResults} />
        )}
        {/* TICKET_151_2: Trades tab with vertical stacking (same as Charts) */}
        {effectiveActiveTab === 'trades' && (
          <TradesTab
            results={allResults}
            currentCaseIndex={currentCaseIndex}
            isExecuting={isExecuting}
            totalCases={totalCases}
            scrollToCaseRef={scrollToTradesCaseRef}
          />
        )}
        {effectiveActiveTab === 'charts' && (
          <ChartsTab
            results={allResults}
            currentCaseIndex={currentCaseIndex}
            isExecuting={isExecuting}
            totalCases={totalCases}
            scrollToCaseRef={scrollToChartsCaseRef}
            processedBars={processedBars}
            backtestTotalBars={backtestTotalBars}
          />
        )}
      </div>
    </div>
  );
};

export default BacktestResultPanel;

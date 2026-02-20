/**
 * EquityCurveChart Component
 *
 * PLUGIN_TICKET_016: SVG equity curve chart.
 * TICKET_377: safeMinMax + downsampleLTTB for large datasets.
 * TICKET_386: Progressive equity rendering via processedBars (same pattern as back-test-nexus).
 * TICKET_386 Phase 2: Fixed X-axis via backtestTotalBars + originalIndices mapping.
 * Adapted from back-test-nexus SingleCaseCharts.renderEquityCurve().
 */

import React from 'react';
import { EquityPoint } from '../types';
import { formatPercent } from '../utils/format-utils';
import { safeMinMax, downsampleLTTB, MAX_RENDER_POINTS } from '../utils/downsample-utils';
import { formatNumber } from '@shared/utils/format-locale';

interface EquityCurveChartProps {
  equityCurve: EquityPoint[];
  /** TICKET_384: When true, show spinner instead of "no data" text */
  isExecuting?: boolean;
  /** TICKET_386: Progressive equity rendering - limit display to processedBars */
  processedBars?: number;
  backtestTotalBars?: number;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ equityCurve, isExecuting, processedBars = 0, backtestTotalBars }) => {
  const gradientId = React.useId();

  if (!equityCurve || equityCurve.length < 2) {
    return (
      <div className="border border-color-terminal-border rounded p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="flex items-center justify-center h-[168px] text-color-terminal-text-muted text-xs">
          {isExecuting ? (
            <svg className="animate-spin w-8 h-8 text-color-terminal-accent-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          ) : (
            'No equity data available'
          )}
        </div>
      </div>
    );
  }

  // Filter invalid values
  const validCurve = equityCurve.filter(p =>
    Number.isFinite(p.equity) && Math.abs(p.equity) < 1e15
  );

  // TICKET_386: Limit equity display to processedBars for synchronized progressive rendering
  const displayLimit = isExecuting
    ? Math.min(processedBars, validCurve.length)
    : validCurve.length;
  const displayCurve = validCurve.slice(0, displayLimit);

  if (displayCurve.length < 2) {
    return (
      <div className="border border-color-terminal-border rounded p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="flex items-center justify-center h-[168px] text-color-terminal-text-muted text-xs">
          Insufficient equity data
        </div>
      </div>
    );
  }

  // TICKET_377: safeMinMax avoids V8 stack overflow on Math.min(...spread)
  const { min: rawMin, max: rawMax } = safeMinMax(displayCurve, p => p.equity);
  const minEquity = rawMin * 0.98;
  const maxEquity = rawMax * 1.02;
  const range = maxEquity - minEquity || 1;

  // TICKET_377: downsampleLTTB limits SVG render points to MAX_RENDER_POINTS
  const renderCurve = downsampleLTTB(displayCurve, MAX_RENDER_POINTS, p => p.equity);

  const width = 100;
  const height = 100;

  // TICKET_386 Phase 2: Use backtestTotalBars as fixed X-axis anchor during execution
  // Same pattern as back-test-nexus ChartsTab.tsx line 119:
  //   const totalXPoints = candles?.length || displayEquityCurve.length;
  const totalXPoints = isExecuting && backtestTotalBars
    ? backtestTotalBars
    : displayCurve.length;

  // TICKET_386 Phase 2: Map downsampled points back to original indices
  // Same pattern as back-test-nexus ChartsTab.tsx line 123-124
  const originalIndices = new Map<EquityPoint, number>();
  for (let i = 0; i < displayCurve.length; i++) originalIndices.set(displayCurve[i], i);

  // Equity line points
  const equityPoints = renderCurve.map((point) => {
    const origIdx = originalIndices.get(point) ?? 0;
    const x = (origIdx / (totalXPoints - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Area fill path - close at last equity point's X position (not full width)
  const lastOrigIdx = originalIndices.get(renderCurve[renderCurve.length - 1]) ?? (displayCurve.length - 1);
  const lastX = (lastOrigIdx / (totalXPoints - 1)) * width;
  const areaPath = `M 0,${height} ` + renderCurve.map((point) => {
    const origIdx = originalIndices.get(point) ?? 0;
    const x = (origIdx / (totalXPoints - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return `L ${x},${y}`;
  }).join(' ') + ` L ${lastX},${height} Z`;

  const startEquity = displayCurve[0].equity;
  const endEquity = displayCurve[displayCurve.length - 1].equity;
  const pnl = endEquity - startEquity;
  const returnPct = startEquity > 0 ? (pnl / startEquity) * 100 : 0;
  const color = pnl >= 0 ? '#4ade80' : '#f87171';

  // Sanitize gradientId for SVG (replace colons with dashes)
  const safeGradientId = `eqGrad${gradientId.replace(/:/g, '-')}`;

  return (
    <div className="border border-color-terminal-border rounded" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-color-terminal-border/50">
        <span className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted">
          EQUITY CURVE
        </span>
        <span className={`text-xs tabular-nums font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          ${formatNumber(endEquity, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({formatPercent(returnPct)})
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 168 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={safeGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${safeGradientId})`} />
        <polyline fill="none" stroke={color} strokeWidth="0.3" points={equityPoints} />
      </svg>
    </div>
  );
};

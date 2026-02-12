/**
 * EquityCurveChart Component
 *
 * PLUGIN_TICKET_016: SVG equity curve chart.
 * Adapted from back-test-nexus SingleCaseCharts.renderEquityCurve() (lines 380-473),
 * simplified: no processedBars sync, no K-line reference, no isExecuting state.
 */

import React from 'react';
import { EquityPoint } from '../types';
import { formatPercent } from '../utils/format-utils';
import { formatNumber } from '@shared/utils/format-locale';

interface EquityCurveChartProps {
  equityCurve: EquityPoint[];
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ equityCurve }) => {
  const gradientId = React.useId();

  if (!equityCurve || equityCurve.length < 2) {
    return (
      <div className="border border-color-terminal-border rounded p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="flex items-center justify-center h-[168px] text-color-terminal-text-muted text-xs">
          No equity data available
        </div>
      </div>
    );
  }

  // Filter invalid values
  const validCurve = equityCurve.filter(p =>
    Number.isFinite(p.equity) && Math.abs(p.equity) < 1e15
  );

  if (validCurve.length < 2) {
    return (
      <div className="border border-color-terminal-border rounded p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="flex items-center justify-center h-[168px] text-color-terminal-text-muted text-xs">
          Insufficient equity data
        </div>
      </div>
    );
  }

  const minEquity = Math.min(...validCurve.map(p => p.equity)) * 0.98;
  const maxEquity = Math.max(...validCurve.map(p => p.equity)) * 1.02;
  const range = maxEquity - minEquity || 1;

  const width = 100;
  const height = 100;

  // Equity line points
  const equityPoints = validCurve.map((point, index) => {
    const x = (index / (validCurve.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Area fill path
  const areaPath = `M 0,${height} ` + validCurve.map((point, index) => {
    const x = (index / (validCurve.length - 1)) * width;
    const y = height - ((point.equity - minEquity) / range) * height;
    return `L ${x},${y}`;
  }).join(' ') + ` L ${width},${height} Z`;

  const startEquity = validCurve[0].equity;
  const endEquity = validCurve[validCurve.length - 1].equity;
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

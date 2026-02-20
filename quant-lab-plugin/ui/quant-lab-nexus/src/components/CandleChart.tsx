/**
 * CandleChart Component
 *
 * TICKET_383: SVG candlestick chart for Alpha Factory results.
 * Adapted from back-test-nexus ChartsTab.renderKLineChart().
 * Simplified: no processedBars sync, no isExecuting/isCancelled states, no i18n.
 */

import React from 'react';
import type { Candle, ExecutorTrade } from '../types';
import { safeMinMax, downsampleOHLC, MAX_RENDER_POINTS } from '../utils/downsample-utils';
import { CANDLE_COLOR_BULLISH, CANDLE_COLOR_BEARISH } from '@plugins/data-plugin/utils/chart-utils';

interface CandleChartProps {
  candles: Candle[];
  trades: ExecutorTrade[];
}

export const CandleChart: React.FC<CandleChartProps> = ({ candles, trades }) => {
  if (!candles || candles.length === 0) {
    return (
      <div className="border border-color-terminal-border rounded p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="flex items-center justify-center h-[168px] text-color-terminal-text-muted text-xs">
          No candle data available
        </div>
      </div>
    );
  }

  const viewWidth = 100;
  const viewHeight = 100;
  const margin = { top: 5, bottom: 15 };
  const chartHeight = viewHeight - margin.top - margin.bottom;

  const { min: rawMinPrice } = safeMinMax(candles, c => c.low);
  const { max: rawMaxHigh } = safeMinMax(candles, c => c.high);
  const minPrice = rawMinPrice * 0.998;
  const maxPrice = rawMaxHigh * 1.002;
  const priceRange = maxPrice - minPrice || 1;

  const renderCandles = downsampleOHLC(candles, MAX_RENDER_POINTS);
  const candleWidth = viewWidth / renderCandles.length;
  const bodyWidth = candleWidth * 0.7;

  const priceToY = (price: number) =>
    margin.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  // Sample trades for markers (max 50)
  const sampledTrades = trades
    .filter((_, idx) => idx % Math.max(1, Math.ceil(trades.length / 50)) === 0)
    .slice(0, 50);

  return (
    <div className="border border-color-terminal-border rounded" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-color-terminal-border/50">
        <span className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted">
          K-LINE CHART
        </span>
        <span className="text-[10px] text-color-terminal-text-muted tabular-nums">
          {candles.length} bars
        </span>
      </div>

      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full"
        style={{ height: 168 }}
        preserveAspectRatio="none"
      >
        {/* Price grid lines */}
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

        {/* Candlesticks */}
        {renderCandles.map((candle, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isUp = candle.close >= candle.open;
          const color = isUp ? CANDLE_COLOR_BULLISH : CANDLE_COLOR_BEARISH;
          const bodyTop = priceToY(Math.max(candle.open, candle.close));
          const bodyBottom = priceToY(Math.min(candle.open, candle.close));
          const bodyH = Math.max(0.3, bodyBottom - bodyTop);

          return (
            <g key={i}>
              <line
                x1={x} x2={x}
                y1={priceToY(candle.high)}
                y2={priceToY(candle.low)}
                stroke={color}
                strokeWidth={0.1}
              />
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
        {sampledTrades.map((trade, i) => {
          const tradeTime = trade.entryTime;
          const origCandleIndex = candles.findIndex((c, idx) =>
            c.timestamp <= tradeTime && (idx === candles.length - 1 || candles[idx + 1].timestamp > tradeTime)
          );
          if (origCandleIndex < 0) return null;

          const dsIndex = Math.floor(origCandleIndex / (candles.length / renderCandles.length));
          const x = Math.min(dsIndex, renderCandles.length - 1) * candleWidth + candleWidth / 2;
          const y = priceToY(trade.entryPrice);
          const isBuy = trade.side.toLowerCase().includes('buy');

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={0.8}
              fill={isBuy ? CANDLE_COLOR_BULLISH : CANDLE_COLOR_BEARISH}
              stroke="#fff"
              strokeWidth={0.15}
            />
          );
        })}

        {/* Price labels */}
        <text
          x={viewWidth - 1}
          y={margin.top + 2}
          className="text-[2px] fill-color-terminal-text-muted"
          textAnchor="end"
        >
          {maxPrice.toFixed(0)}
        </text>
        <text
          x={viewWidth - 1}
          y={viewHeight - margin.bottom - 1}
          className="text-[2px] fill-color-terminal-text-muted"
          textAnchor="end"
        >
          {minPrice.toFixed(0)}
        </text>
      </svg>
    </div>
  );
};

/**
 * TradesTable Component
 *
 * PLUGIN_TICKET_016: Trade history table.
 * Adapted from back-test-nexus SingleCaseTrades (lines 171-227).
 * No i18n, hardcoded English headers.
 */

import React from 'react';
import { ExecutorTrade } from '../types';
import { formatCurrency, formatDate, getColorClass, safeNum } from '../utils/format-utils';

interface TradesTableProps {
  trades: ExecutorTrade[];
}

export const TradesTable: React.FC<TradesTableProps> = ({ trades }) => {
  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-color-terminal-border p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
        <div className="py-8 text-center text-xs text-color-terminal-text-muted">
          No trades executed
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-color-terminal-border p-4" style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-color-terminal-text-muted mb-3">
        TRADES
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-color-terminal-border text-left">
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">#</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Entry Time</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Exit Time</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted">Side</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Entry Price</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Exit Price</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">Qty</th>
              <th className="pb-2 pr-4 font-medium text-color-terminal-text-muted text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 100).map((trade, index) => (
              <tr key={index} className="border-b border-color-terminal-border/50 hover:bg-color-terminal-surface/30">
                <td className="py-2 pr-4 text-color-terminal-text-muted">{index + 1}</td>
                <td className="py-2 pr-4 text-color-terminal-text tabular-nums">{formatDate(safeNum(trade.entryTime))}</td>
                <td className="py-2 pr-4 text-color-terminal-text tabular-nums">{formatDate(safeNum(trade.exitTime))}</td>
                <td className={`py-2 pr-4 font-medium ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
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
                <td className={`py-2 pr-4 text-right font-medium tabular-nums ${getColorClass(trade.pnl)}`}>
                  {formatCurrency(trade.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.length > 100 && (
          <div className="mt-2 text-xs text-color-terminal-text-muted">
            Showing 100 of {trades.length} trades
          </div>
        )}
      </div>
    </div>
  );
};

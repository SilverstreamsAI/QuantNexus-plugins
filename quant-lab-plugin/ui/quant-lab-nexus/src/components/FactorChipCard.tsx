/**
 * FactorChipCard Component
 *
 * TICKET_276: Factor display card for Alpha Factory Factor layer.
 * Shows factor name, category badge, IC/ICIR/Sharpe metrics.
 * Mirrors SignalChip visual pattern with amber accent for factor distinction.
 */

import React from 'react';
import { X } from 'lucide-react';

interface FactorChipCardProps {
  name: string;
  category: string;
  ic: number | null;
  icir: number | null;
  sharpe: number | null;
  onRemove: () => void;
}

const formatMetric = (val: number | null, decimals = 3): string => {
  if (val == null) return '--';
  return val.toFixed(decimals);
};

export const FactorChipCard: React.FC<FactorChipCardProps> = ({
  name,
  category,
  ic,
  icir,
  sharpe,
  onRemove,
}) => {
  return (
    <div className="h-[140px] rounded-lg border border-amber-500/50 hover:border-amber-500 bg-color-terminal-surface transition-colors flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-2 py-1.5 bg-amber-600 flex-shrink-0">
        <span className="text-[11px] font-medium text-white truncate" title={name}>
          {name}
        </span>
      </div>

      {/* Metrics */}
      <div className="px-2 pt-2 pb-1 flex-1 bg-white/5">
        <div className="mb-1.5">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-amber-500/15 text-amber-400">
            {category}
          </span>
        </div>
        <div className="space-y-0.5 text-[10px] text-color-terminal-text-secondary">
          <div className="flex justify-between">
            <span>IC:</span>
            <span className="text-color-terminal-text-primary">{formatMetric(ic)}</span>
          </div>
          <div className="flex justify-between">
            <span>ICIR:</span>
            <span className="text-color-terminal-text-primary">{formatMetric(icir)}</span>
          </div>
          <div className="flex justify-between">
            <span>Sharpe:</span>
            <span className="text-color-terminal-text-primary">{formatMetric(sharpe, 2)}</span>
          </div>
        </div>
      </div>

      {/* Footer: delete button */}
      <div className="px-2 py-1 flex-shrink-0 bg-white/5">
        <button
          onClick={onRemove}
          className="p-0.5 rounded transition-all text-color-terminal-text-muted opacity-50 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

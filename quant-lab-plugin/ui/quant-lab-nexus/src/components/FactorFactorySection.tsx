/**
 * FactorFactorySection Component
 *
 * TICKET_276: Factor Factory section for Alpha Factory page.
 * Parallel to SignalFactorySection - displays factor chips grid,
 * factor combinator selector, and lookback input.
 * Mirrors SignalFactorySection layout pattern.
 */

import React from 'react';
import { BarChart3, Plus } from 'lucide-react';
import { FactorChip } from '../types';
import { FACTOR_COMBINATOR_METHODS } from '../constants';
import { FactorChipCard } from './FactorChipCard';

interface FactorFactorySectionProps {
  factors: FactorChip[];
  method: string;
  lookback: number;
  onAddFactor: () => void;
  onRemoveFactor: (id: string) => void;
  onMethodChange: (method: string) => void;
  onLookbackChange: (days: number) => void;
}

export const FactorFactorySection: React.FC<FactorFactorySectionProps> = ({
  factors,
  method,
  lookback,
  onAddFactor,
  onRemoveFactor,
  onMethodChange,
  onLookbackChange,
}) => {
  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-amber-400" />
        FACTOR FACTORY (Alpha Scores)
      </h2>

      {/* Factor Cards Grid: 5 per row */}
      <div className="min-h-[80px] p-4 rounded-lg border border-dashed border-color-terminal-border bg-color-terminal-surface/20 mb-4">
        <div className="grid grid-cols-5 gap-3">
          {factors.map(factor => (
            <FactorChipCard
              key={factor.id}
              name={factor.name}
              category={factor.category}
              ic={factor.ic}
              icir={factor.icir}
              sharpe={factor.sharpe}
              onRemove={() => onRemoveFactor(factor.id)}
            />
          ))}
          {/* Add Button */}
          <button
            onClick={onAddFactor}
            className="h-[140px] rounded-lg border border-dashed border-color-terminal-border hover:border-amber-400 text-color-terminal-text-secondary hover:text-amber-400 transition-colors flex flex-col items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs">Add Factor</span>
          </button>
        </div>
      </div>

      {/* Combinator Config */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-color-terminal-surface/10 border border-color-terminal-border/50">
        <label className="text-sm text-color-terminal-text-secondary">Combinator:</label>
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
        >
          {FACTOR_COMBINATOR_METHODS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <label className="text-sm text-color-terminal-text-secondary ml-4">Lookback:</label>
        <input
          type="number"
          value={lookback}
          onChange={e => onLookbackChange(parseInt(e.target.value) || 60)}
          className="w-20 px-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
        />
        <span className="text-sm text-color-terminal-text-secondary">days</span>
      </div>
    </section>
  );
};

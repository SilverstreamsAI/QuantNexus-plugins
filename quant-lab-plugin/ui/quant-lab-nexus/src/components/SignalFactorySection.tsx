/**
 * SignalFactorySection Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Signal Factory (Entry) section: signal chips + combinator selector + lookback input.
 */

import React from 'react';
import { Layers, Plus } from 'lucide-react';
import { SignalChip as SignalChipType } from '../types';
import { SIGNAL_COMBINATOR_METHODS } from '../constants';
import { SignalChip } from './SignalChip';

interface SignalFactorySectionProps {
  signals: SignalChipType[];
  method: string;
  lookback: number;
  onAddSignal: () => void;
  onRemoveSignal: (id: string) => void;
  onMethodChange: (method: string) => void;
  onLookbackChange: (days: number) => void;
}

export const SignalFactorySection: React.FC<SignalFactorySectionProps> = ({
  signals,
  method,
  lookback,
  onAddSignal,
  onRemoveSignal,
  onMethodChange,
  onLookbackChange,
}) => {
  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-color-terminal-accent-primary" />
        SIGNAL FACTORY (Entry)
      </h2>

      {/* Signal Chips Container */}
      <div className="min-h-[80px] p-4 rounded-lg border border-dashed border-color-terminal-border bg-color-terminal-surface/20 mb-4">
        <div className="flex flex-wrap gap-2">
          {signals.map(signal => (
            <SignalChip
              key={signal.id}
              name={signal.name}
              onRemove={() => onRemoveSignal(signal.id)}
            />
          ))}
          {/* Add Button */}
          <button
            onClick={onAddSignal}
            className="h-10 px-4 rounded-lg border border-dashed border-color-terminal-border hover:border-color-terminal-accent-primary text-color-terminal-text-secondary hover:text-color-terminal-accent-primary transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Signal</span>
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
          {SIGNAL_COMBINATOR_METHODS.map(m => (
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

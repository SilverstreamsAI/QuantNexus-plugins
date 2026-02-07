/**
 * ExitFactorySection Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Exit Factory (Risk/Exit) section: exit chips + combinator selector.
 */

import React from 'react';
import { Play, Plus } from 'lucide-react';
import { SignalChip as SignalChipType } from '../types';
import { EXIT_COMBINATOR_METHODS } from '../constants';
import { SignalChip } from './SignalChip';

interface ExitFactorySectionProps {
  exits: SignalChipType[];
  method: string;
  onAddExit: () => void;
  onRemoveExit: (id: string) => void;
  onMethodChange: (method: string) => void;
}

export const ExitFactorySection: React.FC<ExitFactorySectionProps> = ({
  exits,
  method,
  onAddExit,
  onRemoveExit,
  onMethodChange,
}) => {
  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <Play className="w-5 h-5 text-color-terminal-accent-teal" />
        EXIT FACTORY (Risk/Exit)
      </h2>

      {/* Exit Chips Container */}
      <div className="min-h-[80px] p-4 rounded-lg border border-dashed border-color-terminal-border bg-color-terminal-surface/20 mb-4">
        <div className="flex flex-wrap gap-2">
          {exits.map(exit => (
            <SignalChip
              key={exit.id}
              name={exit.name}
              onRemove={() => onRemoveExit(exit.id)}
              variant="exit"
            />
          ))}
          {/* Add Button */}
          <button
            onClick={onAddExit}
            className="h-10 px-4 rounded-lg border border-dashed border-color-terminal-border hover:border-color-terminal-accent-teal text-color-terminal-text-secondary hover:text-color-terminal-accent-teal transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Exit</span>
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
          {EXIT_COMBINATOR_METHODS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    </section>
  );
};

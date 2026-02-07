/**
 * ActionBar Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Validate / Save / Run buttons for Alpha Factory.
 */

import React from 'react';

interface ActionBarProps {
  onValidate: () => void;
  onSave: () => void;
  onRunBacktest: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ onValidate, onSave, onRunBacktest }) => {
  return (
    <div className="flex justify-center gap-4">
      <button
        onClick={onValidate}
        className="px-6 py-3 rounded-lg border border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-primary hover:text-color-terminal-accent-primary transition-colors"
      >
        Validate
      </button>
      <button
        onClick={onSave}
        className="px-6 py-3 rounded-lg border border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-primary hover:text-color-terminal-accent-primary transition-colors"
      >
        Save Workflow
      </button>
      <button
        onClick={onRunBacktest}
        className="px-6 py-3 rounded-lg bg-color-terminal-accent-primary text-white hover:bg-color-terminal-accent-primary/80 transition-colors"
      >
        Run Backtest
      </button>
    </div>
  );
};

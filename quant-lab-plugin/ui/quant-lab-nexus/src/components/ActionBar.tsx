/**
 * ActionBar Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * PLUGIN_TICKET_011: "Save Workflow" -> "Save As" (auto-save handles persistence)
 * PLUGIN_TICKET_015: Added isRunning/canRun props for backtest state
 * TICKET_422_6: Internationalized with i18n translations
 * Validate / Save As / Run buttons for Alpha Factory.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface ActionBarProps {
  onValidate: () => void;
  onSaveAs: () => void;
  onRunBacktest: () => void;
  isRunning?: boolean;
  canRun?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onValidate, onSaveAs, onRunBacktest, isRunning = false, canRun = true,
}) => {
  const { t } = useTranslation('quant-lab');

  return (
    <div className="flex justify-center gap-4">
      <button
        onClick={onValidate}
        disabled={isRunning}
        className="px-6 py-3 rounded-lg border border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-primary hover:text-color-terminal-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('actionBar.validate')}
      </button>
      <button
        onClick={onSaveAs}
        disabled={isRunning}
        className="px-6 py-3 rounded-lg border border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-primary hover:text-color-terminal-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('actionBar.saveAs')}
      </button>
      <button
        onClick={onRunBacktest}
        disabled={isRunning || !canRun}
        className="px-6 py-3 rounded-lg bg-color-terminal-accent-primary text-white hover:bg-color-terminal-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isRunning && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isRunning ? t('actionBar.running') : t('actionBar.runBacktest')}
      </button>
    </div>
  );
};

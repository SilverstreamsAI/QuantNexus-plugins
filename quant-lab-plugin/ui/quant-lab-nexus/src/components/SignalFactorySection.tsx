/**
 * SignalFactorySection Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * PLUGIN_TICKET_010: Grid layout (5 per row), pass component details and timeframe change handler
 * TICKET_422_6: Internationalized with i18n translations
 * Signal Factory (Entry) section: signal chips + combinator selector + lookback input.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
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
  onTimeframeChange: (signalId: string, component: 'analysis' | 'entry' | 'exit', timeframe: string) => void;
}

export const SignalFactorySection: React.FC<SignalFactorySectionProps> = ({
  signals,
  method,
  lookback,
  onAddSignal,
  onRemoveSignal,
  onMethodChange,
  onLookbackChange,
  onTimeframeChange,
}) => {
  const { t } = useTranslation('quant-lab');

  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-color-terminal-accent-primary" />
        {t('signalFactory.title')}
      </h2>

      {/* Signal Cards Grid: 5 per row */}
      <div className="min-h-[80px] p-4 rounded-lg border border-dashed border-color-terminal-border bg-color-terminal-surface/20 mb-4">
        <div className="grid grid-cols-5 gap-3">
          {signals.map(signal => (
            <SignalChip
              key={signal.id}
              name={signal.name}
              onRemove={() => onRemoveSignal(signal.id)}
              analysis={signal.analysis}
              entry={signal.entry}
              exit={signal.exit}
              onTimeframeChange={(component, timeframe) => onTimeframeChange(signal.id, component, timeframe)}
            />
          ))}
          {/* Add Button: same height as cards */}
          <button
            onClick={onAddSignal}
            className="h-[200px] rounded-lg border border-dashed border-color-terminal-border hover:border-color-terminal-accent-primary text-color-terminal-text-secondary hover:text-color-terminal-accent-primary transition-colors flex flex-col items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs">{t('signalFactory.addSignal')}</span>
          </button>
        </div>
      </div>

      {/* Combinator Config */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-color-terminal-surface/10 border border-color-terminal-border/50">
        <label className="text-sm text-color-terminal-text-secondary">{t('signalFactory.combinator')}</label>
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
        >
          {SIGNAL_COMBINATOR_METHODS.map(m => (
            <option key={m.id} value={m.id}>{t(`combinatorMethods.signal.${m.id}`)}</option>
          ))}
        </select>
        <label className="text-sm text-color-terminal-text-secondary ml-4">{t('signalFactory.lookback')}</label>
        <input
          type="number"
          value={lookback}
          onChange={e => onLookbackChange(parseInt(e.target.value) || 60)}
          className="w-20 px-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
        />
        <span className="text-sm text-color-terminal-text-secondary">{t('signalFactory.days')}</span>
      </div>
    </section>
  );
};

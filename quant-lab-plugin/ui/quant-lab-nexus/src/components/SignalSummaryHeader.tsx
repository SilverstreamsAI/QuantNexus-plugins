/**
 * SignalSummaryHeader Component
 *
 * PLUGIN_TICKET_016: Compact summary of signal config, exit rules, and data settings.
 * 3 rows: signals + method | exit rules + method | symbol + dates + capital.
 */

import React from 'react';
import { SignalChip, ExitRules, DataConfig } from '../types';
import { SIGNAL_COMBINATOR_METHODS, EXIT_COMBINATOR_METHODS, RISK_RULE_META } from '../constants';

interface SignalSummaryHeaderProps {
  signals: SignalChip[];
  signalMethod: string;
  lookback: number;
  exitRules: ExitRules;
  exitMethod: string;
  dataConfig: DataConfig;
}

export const SignalSummaryHeader: React.FC<SignalSummaryHeaderProps> = ({
  signals, signalMethod, lookback, exitRules, exitMethod, dataConfig,
}) => {
  const methodName = SIGNAL_COMBINATOR_METHODS.find(m => m.id === signalMethod)?.name || signalMethod;
  const exitMethodName = EXIT_COMBINATOR_METHODS.find(m => m.id === exitMethod)?.name || exitMethod;

  const enabledRules = RISK_RULE_META.filter(meta => {
    const rule = exitRules[meta.key] as { enabled: boolean };
    return rule?.enabled;
  });

  return (
    <div className="rounded-lg border border-color-terminal-border p-3 space-y-2"
         style={{ backgroundColor: 'rgba(10, 25, 47, 0.5)' }}>
      {/* Row 1: Signals + method + lookback */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-color-terminal-text-muted uppercase tracking-wider text-[10px]">Signals:</span>
        {signals.map(s => (
          <span key={s.id} className="px-2 py-0.5 rounded bg-color-terminal-surface/50 border border-color-terminal-border text-color-terminal-text-secondary terminal-mono">
            {s.name}
          </span>
        ))}
        <span className="text-color-terminal-text-muted mx-1">|</span>
        <span className="text-color-terminal-accent-primary terminal-mono">{methodName}</span>
        <span className="text-color-terminal-text-muted">Lookback: {lookback}</span>
      </div>

      {/* Row 2: Exit rules + method */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-color-terminal-text-muted uppercase tracking-wider text-[10px]">Exit:</span>
        {enabledRules.length > 0 ? (
          enabledRules.map(meta => (
            <span key={meta.key} className={`px-2 py-0.5 rounded bg-color-terminal-surface/50 border border-color-terminal-border ${meta.color} terminal-mono`}>
              {meta.label}
            </span>
          ))
        ) : (
          <span className="text-color-terminal-text-muted">None enabled</span>
        )}
        <span className="text-color-terminal-text-muted mx-1">|</span>
        <span className="text-color-terminal-accent-primary terminal-mono">{exitMethodName}</span>
      </div>

      {/* Row 3: Data config */}
      <div className="flex items-center gap-3 text-xs text-color-terminal-text-muted">
        <span className="terminal-mono">{dataConfig.symbol || '-'}</span>
        <span className="text-color-terminal-text-muted">|</span>
        <span className="terminal-mono">{dataConfig.startDate || '-'} ~ {dataConfig.endDate || '-'}</span>
        <span className="text-color-terminal-text-muted">|</span>
        <span className="terminal-mono">${dataConfig.initialCapital.toLocaleString()}</span>
      </div>
    </div>
  );
};

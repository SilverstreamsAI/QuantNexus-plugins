/**
 * SignalChip Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * PLUGIN_TICKET_010: Expanded signal variant to fixed-size card with timeframe dropdowns
 * PLUGIN_TICKET_013: Exit variant also supports fixed-size card when component details provided
 *
 * signal variant: Fixed-size card (5 per row) showing Analysis/Entry/Exit with algorithm names + timeframe dropdowns.
 * exit variant: Fixed-size card with teal accent when component details provided; compact chip fallback otherwise.
 */

import React from 'react';
import { X } from 'lucide-react';
import { SignalChipComponent } from '../types';
import { TIMEFRAME_OPTIONS } from '../constants';

interface SignalChipProps {
  name: string;
  onRemove: () => void;
  variant?: 'signal' | 'exit';
  analysis?: SignalChipComponent;
  entry?: SignalChipComponent;
  exit?: SignalChipComponent;
  onTimeframeChange?: (component: 'analysis' | 'entry' | 'exit', timeframe: string) => void;
}

const ComponentRow: React.FC<{
  label: string;
  algorithmName: string;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}> = ({ label, algorithmName, timeframe, onTimeframeChange }) => (
  <div className="mb-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-color-terminal-text-secondary">
        {label}:
      </span>
      <select
        value={timeframe}
        onChange={e => onTimeframeChange(e.target.value)}
        className="px-1 py-0.5 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-[10px] focus:outline-none focus:border-color-terminal-accent-primary cursor-pointer"
      >
        {TIMEFRAME_OPTIONS.map(tf => (
          <option key={tf} value={tf}>{tf}</option>
        ))}
      </select>
    </div>
    <div className="text-[10px] text-color-terminal-text-primary truncate mt-0.5" title={algorithmName}>
      {algorithmName}
    </div>
  </div>
);

export const SignalChip: React.FC<SignalChipProps> = ({
  name,
  onRemove,
  variant = 'signal',
  analysis,
  entry,
  exit,
  onTimeframeChange,
}) => {
  // PLUGIN_TICKET_013: Exit variant with component details: fixed-size card (teal accent)
  if (variant === 'exit' && analysis && entry) {
    return (
      <div className="h-[200px] rounded-lg border border-color-terminal-accent-teal/50 hover:border-color-terminal-accent-teal bg-color-terminal-surface transition-colors flex flex-col overflow-hidden">
        <div className="flex items-center px-2 py-1.5 bg-color-terminal-accent-teal flex-shrink-0">
          <span className="text-[11px] font-medium text-color-terminal-bg truncate" title={name}>
            {name}
          </span>
        </div>
        <div className="px-2 pt-2 pb-1 flex-1 bg-white/5">
          <ComponentRow
            label="Condition"
            algorithmName={analysis.algorithmName}
            timeframe={analysis.timeframe}
            onTimeframeChange={tf => onTimeframeChange?.('analysis', tf)}
          />
          <ComponentRow
            label="Trigger"
            algorithmName={entry.algorithmName}
            timeframe={entry.timeframe}
            onTimeframeChange={tf => onTimeframeChange?.('entry', tf)}
          />
          {exit && (
            <ComponentRow
              label="Action"
              algorithmName={exit.algorithmName}
              timeframe={exit.timeframe}
              onTimeframeChange={tf => onTimeframeChange?.('exit', tf)}
            />
          )}
        </div>
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
  }

  // Exit variant without component details: compact chip fallback
  if (variant === 'exit') {
    return (
      <div className="h-10 px-3 rounded-lg border border-color-terminal-accent-teal/50 hover:border-color-terminal-accent-teal bg-color-terminal-surface flex items-center gap-2 transition-colors">
        <span className="text-sm text-color-terminal-text-primary">{name}</span>
        <button
          onClick={onRemove}
          className="p-0.5 rounded transition-all text-color-terminal-text-muted opacity-50 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Signal variant with component details: fixed-size card
  if (analysis && entry) {
    return (
      <div className="h-[200px] rounded-lg border border-color-terminal-accent-primary/50 hover:border-color-terminal-accent-primary bg-color-terminal-surface transition-colors flex flex-col overflow-hidden">
        {/* Header: signal name with bg matching top nav (#0a192f) */}
        <div className="flex items-center px-2 py-1.5 bg-color-terminal-accent-teal flex-shrink-0">
          <span className="text-[11px] font-medium text-color-terminal-bg truncate" title={name}>
            {name}
          </span>
        </div>

        {/* Component Rows (lighter than header) */}
        <div className="px-2 pt-2 pb-1 flex-1 bg-white/5">
          <ComponentRow
            label="Analysis"
            algorithmName={analysis.algorithmName}
            timeframe={analysis.timeframe}
            onTimeframeChange={tf => onTimeframeChange?.('analysis', tf)}
          />
          <ComponentRow
            label="Entry"
            algorithmName={entry.algorithmName}
            timeframe={entry.timeframe}
            onTimeframeChange={tf => onTimeframeChange?.('entry', tf)}
          />
          {exit && (
            <ComponentRow
              label="Exit"
              algorithmName={exit.algorithmName}
              timeframe={exit.timeframe}
              onTimeframeChange={tf => onTimeframeChange?.('exit', tf)}
            />
          )}
        </div>

        {/* Footer: delete button bottom-left (matches body brightness) */}
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
  }

  // Signal variant without component details: fallback simple chip
  return (
    <div className="h-10 px-3 rounded-lg border border-color-terminal-accent-primary/50 hover:border-color-terminal-accent-primary bg-color-terminal-surface flex items-center gap-2 transition-colors">
      <span className="text-sm text-color-terminal-text-primary">{name}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded transition-all text-color-terminal-text-muted opacity-50 hover:opacity-100 hover:text-red-400 hover:bg-red-400/10"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

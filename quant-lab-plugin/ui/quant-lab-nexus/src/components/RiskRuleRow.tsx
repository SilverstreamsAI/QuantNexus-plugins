/**
 * RiskRuleRow Component
 *
 * TICKET_275: Individual risk rule row with toggle, priority badge,
 * color-coded icon + label, and children slot for parameter inputs.
 * Inline toggle (no external dependency - quant-lab-plugin standalone).
 */

import React from 'react';

interface RiskRuleRowProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  priority: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

export const RiskRuleRow: React.FC<RiskRuleRowProps> = ({
  label,
  icon,
  color,
  priority,
  enabled,
  onToggle,
  children,
}) => {
  return (
    <div
      className={[
        'p-4 rounded-lg border transition-all duration-200',
        enabled
          ? 'border-color-terminal-border bg-color-terminal-surface/40'
          : 'border-color-terminal-border/30 bg-color-terminal-surface/10 opacity-60',
      ].join(' ')}
    >
      {/* Header: Toggle + Priority + Icon + Label */}
      <div className="flex items-center gap-3 mb-2">
        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={[
            'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-color-terminal-accent-primary/50',
            enabled ? 'bg-color-terminal-accent-primary' : 'bg-color-terminal-border',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
              'mt-0.5',
              enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>

        {/* Priority badge */}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-secondary">
          P{priority}
        </span>

        {/* Icon + Label */}
        <span className={`w-4 h-4 ${color}`}>{icon}</span>
        <span className="text-sm font-medium text-color-terminal-text-primary">{label}</span>
      </div>

      {/* Parameter inputs (collapsed when disabled) */}
      {enabled && (
        <div className="ml-[72px] flex flex-wrap items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * TICKET_275: Hard Safety row (always visible, no toggle).
 */
interface HardSafetyRowProps {
  children: React.ReactNode;
}

export const HardSafetyRow: React.FC<HardSafetyRowProps> = ({ children }) => {
  return (
    <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400">
          ALWAYS ON
        </span>
        <span className="text-sm font-medium text-red-400">Hard Safety Limits</span>
      </div>
      <div className="ml-[72px] flex flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
};

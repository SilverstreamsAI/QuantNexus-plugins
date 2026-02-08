/**
 * DrawdownLimitConfig Component
 *
 * Configuration form for Drawdown Limit risk override rule.
 * Portfolio-level maximum drawdown protection.
 *
 * @see TICKET_274 - Indicator Exit Generator (Risk Manager)
 */

import React, { useRef, useState, useCallback } from 'react';
import { SliderInputGroup } from './SliderInputGroup';
import { PortalDropdown } from './PortalDropdown';
import { RECOVERY_MODES, RULE_DEFAULTS } from '../../services/risk-override-exit-service';
import type { DrawdownLimitRule } from '../../services/risk-override-exit-service';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DrawdownLimitConfigProps {
  rule: DrawdownLimitRule;
  onChange: (rule: DrawdownLimitRule) => void;
}

// Actions specific to drawdown limit
const DRAWDOWN_ACTIONS = [
  { value: 'reduce_all', label: 'Reduce All Positions' },
  { value: 'close_all', label: 'Close All' },
  { value: 'halt_trading', label: 'Halt Trading' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const DrawdownLimitConfig: React.FC<DrawdownLimitConfigProps> = ({
  rule,
  onChange,
}) => {
  const actionRef = useRef<HTMLButtonElement>(null);
  const recoveryRef = useRef<HTMLButtonElement>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const actionLabel = DRAWDOWN_ACTIONS.find(a => a.value === rule.action)?.label || 'Halt Trading';
  const recoveryLabel = RECOVERY_MODES.find(r => r.value === rule.recovery)?.label || 'Auto';

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    onChange({ ...rule, [field]: value });
  }, [rule, onChange]);

  return (
    <div className="space-y-4">
      {/* Max Drawdown */}
      <SliderInputGroup
        label="Max Drawdown"
        hint="from peak equity"
        value={rule.maxDrawdownPercent}
        onChange={(v) => handleFieldChange('maxDrawdownPercent', v)}
        min={-50}
        max={-1}
        step={0.5}
        suffix="%"
        decimals={1}
        rangeText={`Default: ${RULE_DEFAULTS.drawdown_limit.maxDrawdownPercent}%`}
      />

      {/* Action Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-1.5">
          Action
        </label>
        <button
          ref={actionRef}
          onClick={() => setActionOpen(!actionOpen)}
          className="w-full px-3 py-2 text-xs text-left border rounded bg-[#112240] border-[#233554] text-[#e6f1ff] hover:border-color-terminal-accent-primary/50 transition-colors"
        >
          {actionLabel}
        </button>
        <PortalDropdown isOpen={actionOpen} triggerRef={actionRef} onClose={() => setActionOpen(false)}>
          {DRAWDOWN_ACTIONS.map(a => (
            <button
              key={a.value}
              onClick={() => { handleFieldChange('action', a.value); setActionOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {a.label}
            </button>
          ))}
        </PortalDropdown>
      </div>

      {/* Reduce Percent (conditional) */}
      {rule.action === 'reduce_all' && (
        <SliderInputGroup
          label="Reduce By"
          value={rule.reducePercent ?? 50}
          onChange={(v) => handleFieldChange('reducePercent', v)}
          min={10}
          max={90}
          step={5}
          suffix="%"
        />
      )}

      {/* Recovery Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-1.5">
          Recovery Mode
        </label>
        <button
          ref={recoveryRef}
          onClick={() => setRecoveryOpen(!recoveryOpen)}
          className="w-full px-3 py-2 text-xs text-left border rounded bg-[#112240] border-[#233554] text-[#e6f1ff] hover:border-color-terminal-accent-primary/50 transition-colors"
        >
          {recoveryLabel}
        </button>
        <PortalDropdown isOpen={recoveryOpen} triggerRef={recoveryRef} onClose={() => setRecoveryOpen(false)}>
          {RECOVERY_MODES.map(r => (
            <button
              key={r.value}
              onClick={() => { handleFieldChange('recovery', r.value); setRecoveryOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {r.label}
            </button>
          ))}
        </PortalDropdown>
      </div>

      {/* Recovery Bars (conditional) */}
      {rule.recovery === 'auto' && (
        <SliderInputGroup
          label="Recovery After"
          hint="bars of stability"
          value={rule.recoveryBars ?? 20}
          onChange={(v) => handleFieldChange('recoveryBars', v)}
          min={5}
          max={200}
          step={5}
        />
      )}
    </div>
  );
};

export default DrawdownLimitConfig;

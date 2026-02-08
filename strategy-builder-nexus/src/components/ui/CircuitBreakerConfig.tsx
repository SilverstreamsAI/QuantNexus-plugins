/**
 * CircuitBreakerConfig Component
 *
 * Configuration form for Circuit Breaker risk override rule.
 * Force close when loss exceeds threshold per position/group/portfolio.
 *
 * @see TICKET_274 - Indicator Exit Generator (Risk Manager)
 */

import React, { useRef, useState, useCallback } from 'react';
import { SliderInputGroup } from './SliderInputGroup';
import { PortalDropdown } from './PortalDropdown';
import { CB_SCOPES, RULE_DEFAULTS } from '../../services/risk-override-exit-service';
import type { CircuitBreakerRule } from '../../services/risk-override-exit-service';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CircuitBreakerConfigProps {
  rule: CircuitBreakerRule;
  onChange: (rule: CircuitBreakerRule) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const CircuitBreakerConfig: React.FC<CircuitBreakerConfigProps> = ({
  rule,
  onChange,
}) => {
  const scopeRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);

  const scopeLabel = CB_SCOPES.find(s => s.value === rule.scope)?.label || 'Per Position';
  const actionLabel = rule.action === 'close_all' ? 'Close All' : 'Reduce To %';

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    onChange({ ...rule, [field]: value });
  }, [rule, onChange]);

  return (
    <div className="space-y-4">
      {/* Trigger PnL */}
      <SliderInputGroup
        label="Trigger PnL"
        hint="loss threshold"
        value={rule.triggerPnlPercent}
        onChange={(v) => handleFieldChange('triggerPnlPercent', v)}
        min={-50}
        max={-0.5}
        step={0.5}
        suffix="%"
        decimals={1}
        rangeText={`Default: ${RULE_DEFAULTS.circuit_breaker.triggerPnlPercent}%`}
      />

      {/* Scope Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-1.5">
          Scope
        </label>
        <button
          ref={scopeRef}
          onClick={() => setScopeOpen(!scopeOpen)}
          className="w-full px-3 py-2 text-xs text-left border rounded bg-[#112240] border-[#233554] text-[#e6f1ff] hover:border-color-terminal-accent-primary/50 transition-colors"
        >
          {scopeLabel}
        </button>
        <PortalDropdown isOpen={scopeOpen} triggerRef={scopeRef} onClose={() => setScopeOpen(false)}>
          {CB_SCOPES.map(s => (
            <button
              key={s.value}
              onClick={() => { handleFieldChange('scope', s.value); setScopeOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {s.label}
            </button>
          ))}
        </PortalDropdown>
      </div>

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
          {(['close_all', 'reduce_to'] as const).map(a => (
            <button
              key={a}
              onClick={() => { handleFieldChange('action', a); setActionOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {a === 'close_all' ? 'Close All' : 'Reduce To %'}
            </button>
          ))}
        </PortalDropdown>
      </div>

      {/* Reduce To % (conditional) */}
      {rule.action === 'reduce_to' && (
        <SliderInputGroup
          label="Reduce To"
          value={rule.reduceToPercent ?? 50}
          onChange={(v) => handleFieldChange('reduceToPercent', v)}
          min={5}
          max={95}
          step={5}
          suffix="%"
        />
      )}

      {/* Cooldown Bars */}
      <SliderInputGroup
        label="Cooldown"
        hint="bars before re-entry"
        value={rule.cooldownBars}
        onChange={(v) => handleFieldChange('cooldownBars', v)}
        min={0}
        max={100}
        step={1}
        rangeText={`Default: ${RULE_DEFAULTS.circuit_breaker.cooldownBars} bars`}
      />
    </div>
  );
};

export default CircuitBreakerConfig;

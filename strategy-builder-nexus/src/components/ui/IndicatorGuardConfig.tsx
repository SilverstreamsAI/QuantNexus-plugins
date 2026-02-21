/**
 * IndicatorGuardConfig Component
 *
 * Configuration form for Indicator Guard risk override rule.
 * Per-position indicator-based override when extreme zone is reached.
 *
 * @see TICKET_274 - Indicator Exit Generator (Risk Manager)
 */

import React, { useRef, useState, useCallback } from 'react';
import { SliderInputGroup } from './SliderInputGroup';
import { PortalDropdown } from './PortalDropdown';
import { RawIndicatorSelector } from './RawIndicatorSelector';
import type { RawIndicatorBlock } from './RawIndicatorSelector';
import type { IndicatorDefinition } from './IndicatorSelector';
import {
  INDICATOR_CONDITIONS,
  DIRECTION_OPTIONS,
  RULE_DEFAULTS,
} from '../../services/risk-override-exit-service';
import type { IndicatorGuardRule } from '../../services/risk-override-exit-service';

import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface IndicatorGuardConfigProps {
  rule: IndicatorGuardRule;
  onChange: (rule: IndicatorGuardRule) => void;
}

// Subset of conditions for indicator guard (no crosses)
const GUARD_CONDITIONS = INDICATOR_CONDITIONS.filter(
  c => ['>', '<', '>=', '<='].includes(c.value)
);

// Actions for indicator guard
const GUARD_ACTIONS = [
  { value: 'close_position', label: 'Close Position' },
  { value: 'reduce_to', label: 'Reduce To %' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const IndicatorGuardConfig: React.FC<IndicatorGuardConfigProps> = ({
  rule,
  onChange,
}) => {
  const conditionRef = useRef<HTMLButtonElement>(null);
  const appliesToRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [appliesToOpen, setAppliesToOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);

  const conditionLabel = GUARD_CONDITIONS.find(c => c.value === rule.condition)?.label || '>';
  const appliesToLabel = DIRECTION_OPTIONS.find(d => d.value === rule.appliesTo)?.label || 'Both';
  const actionLabel = GUARD_ACTIONS.find(a => a.value === rule.action)?.label || 'Close Position';

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    onChange({ ...rule, [field]: value });
  }, [rule, onChange]);

  // Map rule.indicator to RawIndicatorBlock
  const indicatorBlocks: RawIndicatorBlock[] = rule.indicator?.name
    ? [{
        id: 'guard-ind-0',
        indicatorSlug: rule.indicator.name,
        field: 'close',
        paramValues: rule.indicator.parameters as Record<string, number | string>,
      }]
    : [];

  const handleIndicatorChange = useCallback((blocks: RawIndicatorBlock[]) => {
    if (blocks.length > 0 && blocks[0].indicatorSlug) {
      const params: Record<string, number> = {};
      for (const [k, v] of Object.entries(blocks[0].paramValues)) {
        params[k] = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
      }
      onChange({
        ...rule,
        indicator: {
          name: blocks[0].indicatorSlug,
          parameters: params,
        },
      });
    }
  }, [rule, onChange]);

  return (
    <div className="space-y-4">
      {/* Indicator Selector */}
      <RawIndicatorSelector
        title="GUARD INDICATOR"
        indicators={indicatorData as IndicatorDefinition[]}
        blocks={indicatorBlocks}
        onChange={handleIndicatorChange}
        addButtonLabel="+ Select Indicator"
      />

      {/* Condition Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-1.5">
          Condition
        </label>
        <button
          ref={conditionRef}
          onClick={() => setConditionOpen(!conditionOpen)}
          className="w-full px-3 py-2 text-xs text-left border rounded bg-[#112240] border-[#233554] text-[#e6f1ff] hover:border-color-terminal-accent-primary/50 transition-colors"
        >
          {conditionLabel}
        </button>
        <PortalDropdown isOpen={conditionOpen} triggerRef={conditionRef} onClose={() => setConditionOpen(false)}>
          {GUARD_CONDITIONS.map(c => (
            <button
              key={c.value}
              onClick={() => { handleFieldChange('condition', c.value); setConditionOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {c.label}
            </button>
          ))}
        </PortalDropdown>
      </div>

      {/* Threshold */}
      <SliderInputGroup
        label="Threshold"
        value={rule.threshold}
        onChange={(v) => handleFieldChange('threshold', v)}
        min={0}
        max={100}
        step={1}
        rangeText={`Default: ${RULE_DEFAULTS.indicator_guard.threshold}`}
      />

      {/* Applies To Selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-1.5">
          Applies To
        </label>
        <button
          ref={appliesToRef}
          onClick={() => setAppliesToOpen(!appliesToOpen)}
          className="w-full px-3 py-2 text-xs text-left border rounded bg-[#112240] border-[#233554] text-[#e6f1ff] hover:border-color-terminal-accent-primary/50 transition-colors"
        >
          {appliesToLabel}
        </button>
        <PortalDropdown isOpen={appliesToOpen} triggerRef={appliesToRef} onClose={() => setAppliesToOpen(false)}>
          {DIRECTION_OPTIONS.map(d => (
            <button
              key={d.value}
              onClick={() => { handleFieldChange('appliesTo', d.value); setAppliesToOpen(false); }}
              className="w-full px-3 py-2 text-xs text-left hover:bg-white/10 text-[#e6f1ff] transition-colors"
            >
              {d.label}
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
          {GUARD_ACTIONS.map(a => (
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
    </div>
  );
};

export default IndicatorGuardConfig;

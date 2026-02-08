/**
 * HardSafetyConfig Component
 *
 * Configuration form for the Hard Safety Net (Layer 2).
 * Absolute emergency stop - always active, cannot be disabled.
 *
 * @see TICKET_274 - Indicator Exit Generator (Risk Manager)
 */

import React from 'react';
import { OctagonX } from 'lucide-react';
import { SliderInputGroup } from './SliderInputGroup';
import { RULE_DEFAULTS } from '../../services/risk-override-exit-service';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface HardSafetyConfigProps {
  maxLossPercent: number;
  onChange: (maxLossPercent: number) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const HardSafetyConfig: React.FC<HardSafetyConfigProps> = ({
  maxLossPercent,
  onChange,
}) => {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <OctagonX className="w-4 h-4 text-red-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-red-400">
          Hard Safety Net
        </span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-medium">
          Always Active
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-color-terminal-text-muted mb-4">
        Absolute emergency stop. Last resort protection that activates when all other rules fail.
        This cannot be disabled.
      </p>

      {/* Max Loss Slider */}
      <SliderInputGroup
        label="Max Loss"
        hint="from entry"
        value={maxLossPercent}
        onChange={onChange}
        min={-50}
        max={-5}
        step={0.5}
        suffix="%"
        decimals={1}
        rangeText={`Default: ${RULE_DEFAULTS.hard_safety.maxLossPercent}%`}
      />
    </div>
  );
};

export default HardSafetyConfig;

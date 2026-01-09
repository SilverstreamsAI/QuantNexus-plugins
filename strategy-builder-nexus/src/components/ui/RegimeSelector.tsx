/**
 * RegimeSelector Component (component2)
 *
 * Market regime selector with 5 icon cards.
 * Includes Bespoke input area when "bespoke" mode is selected.
 * Used in Zone C of Strategy Studio pages.
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_077_1 - Page Hierarchy
 */

import React, { useCallback } from 'react';
import { TrendingUp, ArrowLeftRight, Minus, Activity, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RegimeOption {
  key: string;
  label: string;
  icon: React.ElementType;
}

export interface BespokeData {
  name: string;
  notes: string;
}

export interface RegimeSelectorProps {
  /** Component title */
  title?: string;
  /** Currently selected regime key */
  selectedRegime: string;
  /** Callback when regime is selected */
  onSelect: (regime: string) => void;
  /** Custom options (overrides default) */
  options?: RegimeOption[];
  /** Bespoke mode data */
  bespokeData?: BespokeData;
  /** Callback when bespoke data changes */
  onBespokeChange?: (data: BespokeData) => void;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'MARKET REGIME INDICATORS LOGIC';

const DEFAULT_OPTIONS: RegimeOption[] = [
  { key: 'trend', label: 'Trend', icon: TrendingUp },
  { key: 'range', label: 'Range', icon: ArrowLeftRight },
  { key: 'consolidation', label: 'Consolidation', icon: Minus },
  { key: 'oscillation', label: 'Oscillation', icon: Activity },
  { key: 'bespoke', label: 'Bespoke', icon: Pencil },
];

// -----------------------------------------------------------------------------
// RegimeSelector Component
// -----------------------------------------------------------------------------

export const RegimeSelector: React.FC<RegimeSelectorProps> = ({
  title = DEFAULT_TITLE,
  selectedRegime,
  onSelect,
  options = DEFAULT_OPTIONS,
  bespokeData = { name: '', notes: '' },
  onBespokeChange,
  className,
}) => {
  const handleSelect = useCallback((key: string) => {
    onSelect(key);
  }, [onSelect]);

  const handleBespokeNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onBespokeChange?.({ ...bespokeData, name: e.target.value });
  }, [bespokeData, onBespokeChange]);

  const handleBespokeNotesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onBespokeChange?.({ ...bespokeData, notes: e.target.value });
  }, [bespokeData, onBespokeChange]);

  const isBespokeMode = selectedRegime === 'bespoke';

  return (
    <div className={cn('regime-selector', className)}>
      {/* Title - follows Unified Component Title Format */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {title}
      </h2>

      {/* Regime Cards - 5 equal columns spanning full width */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedRegime === option.key;

          return (
            <button
              key={option.key}
              onClick={() => handleSelect(option.key)}
              className={cn(
                'flex flex-col items-center justify-center',
                'py-4',
                'border rounded-lg',
                'bg-color-terminal-surface',
                'transition-all duration-200',
                'cursor-pointer',
                isSelected
                  ? 'border-color-terminal-accent-gold border-2'
                  : 'border-color-terminal-border hover:border-color-terminal-accent-teal/50'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center mb-2',
                  isSelected
                    ? 'bg-color-terminal-accent-gold/20'
                    : 'bg-white/5'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    isSelected
                      ? 'text-color-terminal-accent-gold'
                      : 'text-color-terminal-text-secondary'
                  )}
                />
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-bold capitalize',
                  isSelected
                    ? 'text-color-terminal-text'
                    : 'text-color-terminal-text-secondary'
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bespoke Input Area - shown when bespoke mode is selected */}
      {isBespokeMode && (
        <div className="mt-6 space-y-4 p-4 border border-color-terminal-border rounded-lg bg-color-terminal-surface/50">
          {/* Bespoke Name Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              Bespoke Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bespokeData.name}
              onChange={handleBespokeNameChange}
              placeholder="Enter custom regime name"
              className={cn(
                'w-full px-4 py-3 text-xs terminal-mono',
                'bg-color-terminal-surface border rounded',
                'text-black placeholder:text-gray-500',
                'focus:outline-none focus:border-color-terminal-accent-gold/50',
                'border-color-terminal-border'
              )}
            />
          </div>

          {/* Bespoke Notes Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              Notes <span className="text-color-terminal-text-muted">(Optional)</span>
            </label>
            <input
              type="text"
              value={bespokeData.notes}
              onChange={handleBespokeNotesChange}
              placeholder="Enter notes or description"
              className={cn(
                'w-full px-4 py-3 text-xs terminal-mono',
                'bg-color-terminal-surface border rounded',
                'text-black placeholder:text-gray-500',
                'focus:outline-none focus:border-color-terminal-accent-gold/50',
                'border-color-terminal-border'
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RegimeSelector;

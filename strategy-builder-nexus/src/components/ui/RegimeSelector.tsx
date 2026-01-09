/**
 * RegimeSelector Component (component2)
 *
 * Market regime selector with 5 icon cards.
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

export interface RegimeSelectorProps {
  /** Component title */
  title?: string;
  /** Currently selected regime key */
  selectedRegime: string;
  /** Callback when regime is selected */
  onSelect: (regime: string) => void;
  /** Custom options (overrides default) */
  options?: RegimeOption[];
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
  className,
}) => {
  const handleSelect = useCallback((key: string) => {
    onSelect(key);
  }, [onSelect]);

  return (
    <div className={cn('regime-selector', className)}>
      {/* Title - follows Unified Component Title Format */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {title}
      </h2>

      {/* Regime Cards */}
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedRegime === option.key;

          return (
            <button
              key={option.key}
              onClick={() => handleSelect(option.key)}
              className={cn(
                'flex flex-col items-center justify-center',
                'min-w-[100px] px-6 py-4',
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
    </div>
  );
};

export default RegimeSelector;

/**
 * SliderInputGroup Component
 *
 * Reusable slider + number input component with two-way binding.
 * Fundamental component used across configuration pages.
 *
 * @see TICKET_077_11 - SliderInputGroup Specification
 * @see TICKET_077 - Silverstream UI Component Library (component11)
 */

import React, { useCallback, useId } from 'react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SliderInputGroupProps {
  /** Field label */
  label: string;
  /** Optional hint shown after label in parentheses */
  hint?: string;
  /** Current value */
  value: number;
  /** Change callback */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step: number;
  /** Optional description below slider */
  rangeText?: string;
  /** Number of decimal places for display (default: 0) */
  decimals?: number;
  /** Optional suffix (e.g., "%") */
  suffix?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SliderInputGroup: React.FC<SliderInputGroupProps> = ({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  rangeText,
  decimals = 0,
  suffix,
  disabled = false,
  className,
}) => {
  const inputId = useId();

  // Format value for display
  const formatValue = useCallback(
    (val: number): string => {
      return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
    },
    [decimals]
  );

  // Clamp value to range
  const clampValue = useCallback(
    (val: number): number => {
      return Math.min(max, Math.max(min, val));
    },
    [min, max]
  );

  // Handle slider change
  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onChange(newValue);
    },
    [onChange]
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      if (inputValue === '' || inputValue === '-') {
        return; // Allow empty or negative sign during typing
      }
      const parsed = parseFloat(inputValue);
      if (!isNaN(parsed)) {
        onChange(clampValue(parsed));
      }
    },
    [onChange, clampValue]
  );

  // Handle input blur (ensure value is clamped)
  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value);
      if (isNaN(parsed)) {
        onChange(min);
      } else {
        onChange(clampValue(parsed));
      }
    },
    [onChange, min, clampValue]
  );

  // Calculate slider fill percentage for visual styling
  const fillPercentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Label Row */}
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={inputId}
          className="text-[13px] font-medium text-color-terminal-text"
        >
          {label}
        </label>
        {hint && (
          <span className="text-xs text-color-terminal-text-muted">
            ({hint})
          </span>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-3">
        {/* Slider */}
        <div className="flex-1 relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            disabled={disabled}
            className={cn(
              'w-full h-1 rounded-full appearance-none cursor-pointer',
              'bg-color-terminal-border',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-color-terminal-accent-teal',
              '[&::-webkit-slider-thumb]:cursor-pointer',
              '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200',
              '[&::-webkit-slider-thumb]:hover:scale-110',
              '[&::-webkit-slider-thumb]:shadow-md',
              '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
              '[&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-color-terminal-accent-teal',
              '[&::-moz-range-thumb]:border-0',
              '[&::-moz-range-thumb]:cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed',
              disabled && '[&::-webkit-slider-thumb]:cursor-not-allowed',
              disabled && '[&::-moz-range-thumb]:cursor-not-allowed'
            )}
            style={{
              background: disabled
                ? undefined
                : `linear-gradient(to right, var(--color-terminal-accent-teal) 0%, var(--color-terminal-accent-teal) ${fillPercentage}%, var(--color-terminal-border) ${fillPercentage}%, var(--color-terminal-border) 100%)`,
            }}
            aria-label={label}
          />
        </div>

        {/* Number Input */}
        <div className="flex items-center gap-1">
          <input
            id={inputId}
            type="number"
            min={min}
            max={max}
            step={step}
            value={formatValue(value)}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            className={cn(
              'w-[70px] px-3 py-2 text-center',
              'border border-color-terminal-border rounded',
              'bg-color-terminal-surface text-color-terminal-text',
              'font-mono text-[13px]',
              'focus:outline-none focus:border-color-terminal-accent-teal',
              'transition-colors duration-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          {suffix && (
            <span className="text-[13px] text-color-terminal-text-muted">
              {suffix}
            </span>
          )}
        </div>
      </div>

      {/* Range Text */}
      {rangeText && (
        <p className="text-[11px] text-color-terminal-text-muted">{rangeText}</p>
      )}
    </div>
  );
};

export default SliderInputGroup;

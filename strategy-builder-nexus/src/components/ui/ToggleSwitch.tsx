/**
 * ToggleSwitch Component
 *
 * iOS-style toggle switch with label for enabling/disabling features.
 *
 * @see TICKET_077_14 - ToggleSwitch Specification
 * @see TICKET_077 - Silverstream UI Component Library (component14)
 */

import React, { useId } from 'react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ToggleSwitchProps {
  /** Toggle label */
  label: string;
  /** Current state */
  checked: boolean;
  /** Change callback */
  onChange: (checked: boolean) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Label position (default: 'right') */
  labelPosition?: 'left' | 'right';
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  labelPosition = 'right',
  className,
}) => {
  const inputId = useId();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex items-center gap-3 cursor-pointer select-none',
        labelPosition === 'left' && 'flex-row-reverse',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Hidden checkbox for accessibility */}
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only peer"
        aria-label={label}
      />

      {/* Toggle Track */}
      <div
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          'flex-shrink-0',
          checked
            ? 'bg-color-terminal-accent-teal'
            : 'bg-color-terminal-border',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-color-terminal-accent-teal peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-color-terminal-bg'
        )}
      >
        {/* Toggle Thumb */}
        <div
          className={cn(
            'absolute top-0.5 left-0.5',
            'w-5 h-5 rounded-full',
            'bg-white shadow-md',
            'transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </div>

      {/* Label */}
      <span className="text-[13px] font-medium text-color-terminal-text">
        {label}
      </span>
    </label>
  );
};

export default ToggleSwitch;

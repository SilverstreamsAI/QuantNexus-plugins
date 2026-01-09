/**
 * ExpressionInput Component
 *
 * Logic expression input with help text and add button.
 * Used in Zone C of Strategy Studio pages.
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_063 - Silverstream UI Spec
 */

import React, { useState, useCallback, useRef } from 'react';
import { Plus, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ExpressionInputProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Help text shown below the input */
  helpText?: string;
  /** Label for the add button */
  buttonLabel?: string;
  /** Minimum expression length for validation */
  minLength?: number;
  /** Callback when expression is added */
  onAdd: (expression: string) => void;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_PLACEHOLDER = 'Example: ATR(14) > 0.5 AND RSI(14) < 30';
const DEFAULT_HELP_TEXT = 'Enter custom logic expression. Syntax help will be shown in Assistant.';
const DEFAULT_BUTTON_LABEL = 'Add Strategy';
const DEFAULT_MIN_LENGTH = 3;
const ERROR_FLASH_DURATION = 2000;

// -----------------------------------------------------------------------------
// ExpressionInput Component
// -----------------------------------------------------------------------------

export const ExpressionInput: React.FC<ExpressionInputProps> = ({
  placeholder = DEFAULT_PLACEHOLDER,
  helpText = DEFAULT_HELP_TEXT,
  buttonLabel = DEFAULT_BUTTON_LABEL,
  minLength = DEFAULT_MIN_LENGTH,
  onAdd,
  className,
}) => {
  const [value, setValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (hasError) {
      setHasError(false);
    }
  }, [hasError]);

  // Handle add button click
  const handleAdd = useCallback(() => {
    const trimmedValue = value.trim();

    // Validation
    if (!trimmedValue || trimmedValue.length < minLength) {
      setHasError(true);
      inputRef.current?.focus();

      // Clear error state after duration
      setTimeout(() => {
        setHasError(false);
      }, ERROR_FLASH_DURATION);

      return;
    }

    // Call onAdd callback
    onAdd(trimmedValue);

    // Clear input and refocus
    setValue('');
    inputRef.current?.focus();
  }, [value, minLength, onAdd]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  return (
    <div className={cn('expression-input space-y-3', className)}>
      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className={cn(
          'w-full px-4 py-3 text-xs terminal-mono',
          'bg-color-terminal-surface border rounded',
          'text-black placeholder:text-gray-500',
          'focus:outline-none transition-colors duration-200',
          hasError
            ? 'border-red-500 focus:border-red-500'
            : 'border-color-terminal-border focus:border-color-terminal-accent-gold/50'
        )}
      />

      {/* Help Text */}
      <div className="flex items-start gap-2 text-[10px] text-color-terminal-text-muted">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>{helpText}</span>
      </div>

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={handleAdd}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2',
            'text-[10px] font-bold uppercase tracking-wider',
            'border border-color-terminal-border rounded',
            'hover:border-color-terminal-accent-teal/50 hover:bg-white/5',
            'transition-all'
          )}
        >
          <Plus className="w-3 h-3" />
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default ExpressionInput;

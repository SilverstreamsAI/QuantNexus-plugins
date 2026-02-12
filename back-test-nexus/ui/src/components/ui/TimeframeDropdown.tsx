/**
 * TimeframeDropdown Component
 *
 * Compact timeframe selector for stage-level timeframe configuration.
 * Designed to pair with WorkflowDropdown for multi-timeframe strategy support.
 *
 * @see TICKET_248 - Stage-Level Timeframe Selector
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import type { ColorTheme } from './WorkflowDropdown';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TimeframeValue = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1d' | '1w' | '1M';

export interface TimeframeDropdownProps {
  /** Current timeframe value */
  value: TimeframeValue;
  /** Callback when timeframe changes */
  onChange: (timeframe: TimeframeValue) => void;
  /** TICKET_305: Restrict to provider-supported timeframes */
  allowedValues?: TimeframeValue[];
  /** Color theme (matches paired WorkflowDropdown) */
  theme?: ColorTheme;
  /** Whether dropdown is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TIMEFRAME_OPTIONS: { value: TimeframeValue; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
  { value: '1w', label: '1w' },
  { value: '1M', label: '1M' },
];

// Theme colors matching WorkflowDropdown
const THEME_COLORS: Record<ColorTheme, { border: string; bg: string; text: string; hover: string }> = {
  teal: {
    border: 'border-[#64ffda]',
    bg: 'bg-[#64ffda]/10',
    text: 'text-[#64ffda]',
    hover: 'hover:bg-[#64ffda]/20',
  },
  purple: {
    border: 'border-[#a78bfa]',
    bg: 'bg-[#a78bfa]/10',
    text: 'text-[#a78bfa]',
    hover: 'hover:bg-[#a78bfa]/20',
  },
  blue: {
    border: 'border-[#60a5fa]',
    bg: 'bg-[#60a5fa]/10',
    text: 'text-[#60a5fa]',
    hover: 'hover:bg-[#60a5fa]/20',
  },
  gold: {
    border: 'border-[#fbbf24]',
    bg: 'bg-[#fbbf24]/10',
    text: 'text-[#fbbf24]',
    hover: 'hover:bg-[#fbbf24]/20',
  },
};

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// -----------------------------------------------------------------------------
// TimeframeDropdown Component
// -----------------------------------------------------------------------------

export const TimeframeDropdown: React.FC<TimeframeDropdownProps> = ({
  value,
  onChange,
  allowedValues,
  theme = 'blue',
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const themeColors = THEME_COLORS[theme];

  // TICKET_305: Filter options by provider capabilities
  const filteredOptions = allowedValues
    ? TIMEFRAME_OPTIONS.filter(opt => allowedValues.includes(opt.value))
    : TIMEFRAME_OPTIONS;

  // Update dropdown position
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = filteredOptions.length * 32 + 8; // Approximate height
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const shouldOpenUpward = spaceBelow < dropdownHeight && rect.top > spaceBelow;

    setDropdownPosition({
      top: shouldOpenUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  }, [disabled, isOpen, updatePosition]);

  // Handle option click
  const handleOptionClick = useCallback((timeframe: TimeframeValue) => {
    onChange(timeframe);
    setIsOpen(false);
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      {/* Compact Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-bold rounded border transition-all min-w-[52px]',
          disabled
            ? 'border-color-terminal-border/50 bg-color-terminal-surface/30 text-color-terminal-text-muted cursor-not-allowed opacity-50'
            : cn(themeColors.border, themeColors.bg, themeColors.text, themeColors.hover),
          className
        )}
      >
        <span>{value}</span>
        <ChevronDownIcon
          className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[1001] rounded border border-color-terminal-border bg-[#112240] shadow-xl py-1"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              minWidth: 64,
            }}
          >
            {filteredOptions.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleOptionClick(option.value)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] transition-colors',
                    isSelected
                      ? cn(themeColors.bg, themeColors.text)
                      : 'text-color-terminal-text hover:bg-white/5'
                  )}
                >
                  <span className="font-medium">{option.label}</span>
                  {isSelected && <CheckIcon className="w-3 h-3" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};

export default TimeframeDropdown;

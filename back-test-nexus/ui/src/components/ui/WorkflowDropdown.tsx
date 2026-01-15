/**
 * WorkflowDropdown Component
 *
 * Reusable dropdown component for workflow row selections.
 * Supports search, multi-select, and color themes.
 *
 * @see TICKET_077 - component7 (WorkflowRowSelector)
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AlgorithmOption {
  id: number;
  code: string;
  strategyName: string;
  strategyType: number;
  description?: string;
}

export type ColorTheme = 'teal' | 'purple' | 'blue' | 'gold';

export interface WorkflowDropdownProps {
  /** Button label */
  label: string;
  /** Available options */
  options: AlgorithmOption[];
  /** Selected option IDs */
  selectedIds: number[];
  /** Callback when selection changes */
  onChange: (selectedIds: number[]) => void;
  /** Color theme */
  theme?: ColorTheme;
  /** Whether dropdown is disabled */
  disabled?: boolean;
  /** Allow multiple selections */
  multiSelect?: boolean;
  /** Show search input */
  showSearch?: boolean;
  /** Placeholder for search */
  searchPlaceholder?: string;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Theme Colors
// -----------------------------------------------------------------------------

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
// WorkflowDropdown Component
// -----------------------------------------------------------------------------

export const WorkflowDropdown: React.FC<WorkflowDropdownProps> = ({
  label,
  options,
  selectedIds,
  onChange,
  theme = 'blue',
  disabled = false,
  multiSelect = true,
  showSearch = true,
  searchPlaceholder = 'Search...',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const themeColors = THEME_COLORS[theme];

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.strategyName.toLowerCase().includes(query) ||
        opt.code.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Update dropdown position
  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }
  }, []);

  // Handle open
  const handleOpen = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  }, [disabled, updatePosition]);

  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Handle toggle
  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen, handleClose]);

  // Handle option click
  const handleOptionClick = useCallback(
    (optionId: number) => {
      if (multiSelect) {
        const newSelection = selectedIds.includes(optionId)
          ? selectedIds.filter((id) => id !== optionId)
          : [...selectedIds, optionId];
        onChange(newSelection);
      } else {
        onChange([optionId]);
        handleClose();
      }
    },
    [multiSelect, selectedIds, onChange, handleClose]
  );

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
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClose]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Get selected count text
  const selectedCount = selectedIds.length;
  const buttonText = selectedCount > 0 ? `${label} (${selectedCount})` : label;

  return (
    <>
      {/* Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded border transition-all',
          disabled
            ? 'border-color-terminal-border/50 bg-color-terminal-surface/30 text-color-terminal-text-muted cursor-not-allowed opacity-50'
            : cn(themeColors.border, themeColors.bg, themeColors.text, themeColors.hover),
          className
        )}
      >
        <span className="truncate">{buttonText}</span>
        <ChevronDownIcon
          className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[1000] rounded-lg border border-color-terminal-border bg-[#112240] shadow-xl"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: 456,
            }}
          >
            {/* Search */}
            {showSearch && (
              <div className="p-2 border-b border-color-terminal-border">
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-color-terminal-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-8 py-2 text-xs bg-[#0a192f] border border-color-terminal-border rounded text-color-terminal-text placeholder-color-terminal-text-muted focus:outline-none focus:border-color-terminal-accent-primary"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-color-terminal-text-muted hover:text-color-terminal-text"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List - Limited to 8 items visible, scrollable for more */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-color-terminal-text-muted">
                  No algorithms found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionClick(option.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors',
                        isSelected
                          ? cn(themeColors.bg, themeColors.text)
                          : 'text-color-terminal-text hover:bg-white/5'
                      )}
                    >
                      {/* Checkbox indicator */}
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                          isSelected
                            ? cn(themeColors.border, themeColors.bg)
                            : 'border-color-terminal-border'
                        )}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3" />}
                      </div>

                      {/* Option content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{option.strategyName}</div>
                        {option.description && (
                          <div className="text-[10px] text-color-terminal-text-muted truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default WorkflowDropdown;

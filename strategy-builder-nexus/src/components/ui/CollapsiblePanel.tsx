/**
 * CollapsiblePanel Component
 *
 * Expandable/collapsible panel wrapper with header.
 * Used to organize optional or advanced settings.
 *
 * @see TICKET_077_15 - CollapsiblePanel Specification
 * @see TICKET_077 - Silverstream UI Component Library (component15)
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type BadgeVariant = 'default' | 'success' | 'warning';

export interface CollapsiblePanelProps {
  /** Panel title */
  title: string;
  /** Optional badge text */
  badge?: string;
  /** Badge variant */
  badgeVariant?: BadgeVariant;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Initial expanded state (uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Expand change callback (for controlled mode) */
  onExpandedChange?: (expanded: boolean) => void;
  /** Panel children */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Badge Variant Styles
// -----------------------------------------------------------------------------

const badgeVariantStyles: Record<BadgeVariant, string> = {
  default: 'bg-color-terminal-accent-teal text-color-terminal-bg',
  success: 'bg-green-500 text-white',
  warning: 'bg-color-terminal-accent-gold text-color-terminal-bg',
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  badge,
  badgeVariant = 'default',
  subtitle,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  children,
  className,
}) => {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Determine if controlled or uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Handle toggle
  const handleToggle = useCallback(() => {
    const newState = !isExpanded;

    if (!isControlled) {
      setInternalExpanded(newState);
    }

    onExpandedChange?.(newState);
  }, [isExpanded, isControlled, onExpandedChange]);

  return (
    <div
      className={cn(
        'border border-color-terminal-border rounded-lg',
        'bg-color-terminal-surface overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full flex flex-col p-3',
          'cursor-pointer select-none',
          'hover:bg-white/[0.02] transition-colors duration-200',
          'text-left'
        )}
        aria-expanded={isExpanded}
      >
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold uppercase tracking-wide text-color-terminal-text">
              {title}
            </span>
            {badge && (
              <span
                className={cn(
                  'px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded',
                  badgeVariantStyles[badgeVariant]
                )}
              >
                {badge}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-color-terminal-text-muted',
              'transition-transform duration-300',
              isExpanded && 'rotate-180'
            )}
          />
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-color-terminal-text-muted mt-1">
            {subtitle}
          </p>
        )}
      </button>

      {/* Content with CSS Grid animation */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 border-t border-color-terminal-border">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollapsiblePanel;

/**
 * SessionInfoPanel Component (component19E)
 *
 * Panel displaying session information and token usage.
 *
 * @see TICKET_077_19_AI_STRATEGY_STUDIO_COMPONENTS.md - Component specification
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TokenUsage {
  /** Current token count */
  current: number;
  /** Maximum token limit */
  limit: number;
}

export interface SessionInfoPanelProps {
  /** Session identifier */
  sessionId: string;
  /** Total message count */
  messageCount: number;
  /** Token usage data */
  tokenUsage: TokenUsage;
  /** Show compression warning */
  showCompressionWarning?: boolean;
  /** Compression warning text */
  compressionWarningText?: string;
  /** Visibility state */
  visible?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Token usage thresholds */
const TOKEN_THRESHOLDS = {
  LOW: 0.6,    // 0-60%: green
  MEDIUM: 0.85, // 60-85%: yellow
  // 85-100%: red
} as const;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get usage level based on percentage
 */
function getUsageLevel(percentage: number): 'low' | 'medium' | 'high' {
  if (percentage <= TOKEN_THRESHOLDS.LOW) {
    return 'low';
  } else if (percentage <= TOKEN_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'high';
}

/**
 * Format token count for display
 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Truncate session ID for display
 */
function truncateSessionId(id: string, maxLength: number = 12): string {
  if (id.length <= maxLength) {
    return id;
  }
  return `${id.slice(0, maxLength)}...`;
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface InfoItemProps {
  label: string;
  value: string | number;
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-color-terminal-text-muted">
      {label}:
    </span>
    <span className="text-xs font-medium text-color-terminal-text font-mono">
      {value}
    </span>
  </div>
);

// -----------------------------------------------------------------------------
// Token Usage Bar Styles
// -----------------------------------------------------------------------------

const usageLevelStyles = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
} as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const SessionInfoPanel: React.FC<SessionInfoPanelProps> = ({
  sessionId,
  messageCount,
  tokenUsage,
  showCompressionWarning = false,
  compressionWarningText = 'Conversation may be compressed soon',
  visible = true,
  className,
}) => {
  // Calculate token usage percentage and level
  const { percentage, usageLevel, displayCurrent, displayLimit } = useMemo(() => {
    const pct = tokenUsage.limit > 0 ? tokenUsage.current / tokenUsage.limit : 0;
    return {
      percentage: Math.min(pct * 100, 100),
      usageLevel: getUsageLevel(pct),
      displayCurrent: formatTokenCount(tokenUsage.current),
      displayLimit: tokenUsage.limit > 0 ? formatTokenCount(tokenUsage.limit) : '-',
    };
  }, [tokenUsage]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        // Layout
        'p-4 mx-4 my-3',
        // Appearance
        'bg-color-terminal-surface',
        'border border-color-terminal-border',
        'rounded-lg',
        'shadow-sm',
        className
      )}
    >
      {/* Session Info Row */}
      <div className="flex items-center justify-between mb-3">
        <InfoItem label="Session" value={truncateSessionId(sessionId)} />
        <InfoItem label="Messages" value={messageCount} />
      </div>

      {/* Token Usage Row */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-color-terminal-text-muted">
            Token Usage:
          </span>
          <span className="text-xs font-medium text-color-terminal-text font-mono">
            {displayCurrent} / {displayLimit}
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-2 bg-color-terminal-border rounded overflow-hidden">
          {/* Progress Bar Fill */}
          <div
            className={cn(
              'h-full rounded',
              'transition-all duration-300 ease-out',
              usageLevelStyles[usageLevel]
            )}
            style={{ width: `${percentage}%`, minWidth: tokenUsage.current > 0 ? '2px' : '0' }}
            role="progressbar"
            aria-valuenow={tokenUsage.current}
            aria-valuemin={0}
            aria-valuemax={tokenUsage.limit}
            aria-label={`Token usage: ${percentage.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Compression Warning */}
      {showCompressionWarning && (
        <div
          className={cn(
            'flex items-center gap-2',
            'mt-3 p-2.5',
            'bg-yellow-500/10',
            'border border-yellow-500/30',
            'rounded-md'
          )}
        >
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <span className="text-xs font-medium text-yellow-700">
            {compressionWarningText}
          </span>
        </div>
      )}
    </div>
  );
};

export default SessionInfoPanel;

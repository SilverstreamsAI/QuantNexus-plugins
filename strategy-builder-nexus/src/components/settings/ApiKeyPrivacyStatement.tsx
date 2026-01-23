/**
 * ApiKeyPrivacyStatement - Privacy and security statement for API key storage
 *
 * TICKET_190: BYOK Guest Mode and API Key Privacy
 *
 * Displays clear privacy information about how API keys are stored,
 * following industry best practices (Cline, Continue, etc.).
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ServerOff,
  MonitorOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

interface ApiKeyPrivacyStatementProps {
  /** Show in compact mode (collapsible) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface PrivacyItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

// =============================================================================
// Privacy Items Configuration
// =============================================================================

const PRIVACY_ITEMS: PrivacyItem[] = [
  {
    icon: Lock,
    title: 'Encrypted Storage',
    description:
      'Your API keys are encrypted using your operating system\'s secure credential storage (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux).',
  },
  {
    icon: ServerOff,
    title: 'Local Only',
    description:
      'API keys are stored exclusively on your device. They are never transmitted to or stored on our servers.',
  },
  {
    icon: MonitorOff,
    title: 'No Cross-Device Sync',
    description:
      'Keys are bound to this device and are not synchronized across your devices.',
  },
  {
    icon: Trash2,
    title: 'Full Control',
    description:
      'You can view, edit, or delete your API keys at any time from this settings page.',
  },
];

// =============================================================================
// Component
// =============================================================================

export function ApiKeyPrivacyStatement({
  compact = false,
  className,
}: ApiKeyPrivacyStatementProps): JSX.Element {
  const [expanded, setExpanded] = useState(!compact);

  if (compact) {
    return (
      <div
        className={cn(
          'rounded-lg border border-white/10 bg-gradient-to-r from-color-terminal-accent-teal/5 to-transparent',
          className
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-color-terminal-accent-teal" />
            <span className="font-medium">API Key Security</span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 pt-0">
            <PrivacyContent />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-color-terminal-accent-teal/20 bg-gradient-to-r from-color-terminal-accent-teal/5 to-transparent p-4',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <ShieldCheck className="h-6 w-6 text-color-terminal-accent-teal" />
        <h3 className="text-lg font-semibold">API Key Security</h3>
      </div>
      <PrivacyContent />
    </div>
  );
}

// =============================================================================
// Privacy Content (shared between compact and full modes)
// =============================================================================

function PrivacyContent(): JSX.Element {
  return (
    <div className="space-y-4">
      {/* Privacy Items */}
      <div className="grid gap-3">
        {PRIVACY_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <Icon className="h-4 w-4 text-color-terminal-accent-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Industry Reference */}
      <div className="flex items-start gap-2 pt-3 border-t border-white/5">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          This security model follows industry best practices used by Cline,
          Continue, and other trusted development tools.
        </p>
      </div>
    </div>
  );
}

export default ApiKeyPrivacyStatement;

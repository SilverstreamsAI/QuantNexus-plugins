/**
 * ApiKeyPrompt - Prompt user to configure LLM API key
 *
 * TICKET_190: BYOK Guest Mode and API Key Privacy
 *
 * Shown when user needs to configure API access.
 * Provides two clear options: Use Your Own Key (BYOK) OR Upgrade to PRO.
 */

import React from 'react';
import {
  Key,
  Crown,
  X,
  ShieldCheck,
  ExternalLink,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface ApiKeyPromptProps {
  /** Whether the prompt is visible */
  isOpen: boolean;
  /** User tier (null = guest) */
  userTier: string | null;
  /** Callback when user clicks "Configure API Key" */
  onConfigure: () => void;
  /** Callback when user clicks "Upgrade to PRO" */
  onUpgrade: () => void;
  /** Callback when user clicks "Login" (for guest users) */
  onLogin?: () => void;
  /** Callback when user dismisses the prompt */
  onDismiss: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ApiKeyPrompt({
  isOpen,
  userTier,
  onConfigure,
  onUpgrade,
  onLogin,
  onDismiss,
  className,
}: ApiKeyPromptProps): JSX.Element | null {
  if (!isOpen) return null;

  const isGuest = userTier === null;

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center', className)}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-white/10 bg-color-terminal-panel shadow-2xl">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1 text-color-terminal-text-muted hover:text-color-terminal-text rounded transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h2 className="text-xl font-bold text-center mb-2">
            AI Features Require Setup
          </h2>

          {/* Subtitle */}
          <p className="text-sm text-color-terminal-text-muted text-center mb-6">
            Choose one option to enable AI-powered code generation
          </p>

          {/* Two Options Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Option 1: Use Your Own Key */}
            <div className="relative rounded-lg border border-color-terminal-accent-teal/30 bg-color-terminal-accent-teal/5 p-5 flex flex-col">
              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-color-terminal-accent-teal/10 mb-4">
                <Key className="h-6 w-6 text-color-terminal-accent-teal" />
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold mb-2">Use Your Own Key</h3>

              {/* Features */}
              <ul className="text-xs text-color-terminal-text-muted space-y-2 mb-4 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-teal shrink-0" />
                  <span>Configure API key from Claude, OpenAI, etc.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-teal shrink-0" />
                  <span>Pay only for what you use</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-teal shrink-0" />
                  <span>Key stored locally, never uploaded</span>
                </li>
              </ul>

              {/* Button */}
              <button
                onClick={onConfigure}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-color-terminal-accent-teal text-black font-medium hover:bg-color-terminal-accent-teal/90 transition-colors"
              >
                Configure Key
              </button>
            </div>

            {/* Option 2: Upgrade to PRO */}
            <div className="relative rounded-lg border border-color-terminal-accent-gold/30 bg-color-terminal-accent-gold/5 p-5 flex flex-col">
              {/* Popular badge */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-color-terminal-accent-gold text-black text-[10px] font-bold uppercase tracking-wider rounded-full">
                Recommended
              </div>

              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-color-terminal-accent-gold/10 mb-4">
                <Crown className="h-6 w-6 text-color-terminal-accent-gold" />
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold mb-2">Upgrade to PRO</h3>

              {/* Features */}
              <ul className="text-xs text-color-terminal-text-muted space-y-2 mb-4 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-gold shrink-0" />
                  <span>Unlimited AI generations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-gold shrink-0" />
                  <span>No API key required</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 text-color-terminal-accent-gold shrink-0" />
                  <span>Priority support & advanced features</span>
                </li>
              </ul>

              {/* Button */}
              <button
                onClick={isGuest && onLogin ? onLogin : onUpgrade}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-color-terminal-accent-gold text-black font-medium hover:bg-color-terminal-accent-gold/90 transition-colors"
              >
                {isGuest ? 'Login & Upgrade' : 'Upgrade Now'}
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-center justify-center gap-2 text-xs text-color-terminal-text-muted">
            <ShieldCheck className="h-4 w-4 text-color-terminal-accent-teal" />
            <span>Your API keys are encrypted and stored locally only</span>
          </div>

          {/* Dismiss */}
          <div className="text-center mt-4">
            <button
              onClick={onDismiss}
              className="text-sm text-color-terminal-text-muted hover:text-color-terminal-text transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApiKeyPrompt;

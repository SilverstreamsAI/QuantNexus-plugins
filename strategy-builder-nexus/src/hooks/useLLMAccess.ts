/**
 * useLLMAccess - Hook to check LLM feature access
 *
 * TICKET_190: BYOK Guest Mode and API Key Privacy
 *
 * Provides LLM access checking and API key prompt state management.
 * Used by pages with LLM-powered features (EntrySignalPage, RegimeDetectorPage).
 *
 * Layer 2: checkOnMount option for one-time page entry modal (per session)
 * Layer 3: checkAccess function for button click interception
 */

import { useState, useCallback, useEffect } from 'react';

// Session storage key prefix for page entry modal tracking
const PAGE_ENTRY_MODAL_PREFIX = 'llmAccess_pageEntry_';

// =============================================================================
// Types
// =============================================================================

export interface LLMAccessResult {
  allowed: boolean;
  source: 'platform' | 'byok' | 'none';
  reason: 'platform_key' | 'byok_configured' | 'no_key' | 'default_provider';
  requiresBYOK: boolean;
  userTier: string | null;
  configuredProvider?: string;
}

export interface UseLLMAccessOptions {
  /** Callback when user wants to open settings */
  onOpenSettings?: () => void;
  /** Callback when user wants to upgrade */
  onUpgrade?: () => void;
  /** Callback when user wants to login */
  onLogin?: () => void;
  /** Current LLM provider (to determine if NONA/platform or BYOK) */
  llmProvider?: string;
  /** Check access on mount and show prompt once per session (Layer 2) */
  checkOnMount?: boolean;
  /** Page identifier for session tracking (required if checkOnMount is true) */
  pageId?: string;
}

export interface UseLLMAccessReturn {
  /** Check LLM access before performing action */
  checkAccess: () => Promise<boolean>;
  /** Current access result (from last check) */
  accessResult: LLMAccessResult | null;
  /** Whether the API key prompt is showing */
  showPrompt: boolean;
  /** User tier from last check */
  userTier: string | null;
  /** Close the prompt */
  closePrompt: () => void;
  /** Open settings (to configure API key) */
  openSettings: () => void;
  /** Trigger upgrade flow */
  triggerUpgrade: () => void;
  /** Trigger login flow */
  triggerLogin: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useLLMAccess(options: UseLLMAccessOptions = {}): UseLLMAccessReturn {
  const {
    onOpenSettings,
    onUpgrade,
    onLogin,
    llmProvider = 'NONA',
    checkOnMount = false,
    pageId,
  } = options;

  const [accessResult, setAccessResult] = useState<LLMAccessResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [userTier, setUserTier] = useState<string | null>(null);

  /**
   * Layer 2: Check access on page mount (one-time per session)
   * Shows prompt immediately when entering the page, but only once per session.
   */
  useEffect(() => {
    if (!checkOnMount || !pageId) return;

    const sessionKey = `${PAGE_ENTRY_MODAL_PREFIX}${pageId}`;
    const alreadyShown = sessionStorage.getItem(sessionKey);

    if (alreadyShown === 'true') {
      console.log(`[useLLMAccess] Page entry modal already shown for ${pageId}`);
      return;
    }

    const checkOnPageEntry = async () => {
      try {
        const response = await window.electronAPI.entitlement.canAccessLLMFeatures();
        if (!response.success || !response.data) {
          return;
        }

        const result = response.data;
        setAccessResult(result);
        setUserTier(result.userTier);

        // Determine if prompt should be shown
        let shouldShowPrompt = false;

        // PRO/GOLD users don't need prompt
        if (result.userTier === 'pro' || result.userTier === 'gold') {
          console.log(`[useLLMAccess] PRO/GOLD user - no page entry prompt for ${pageId}`);
          return;
        }

        // NONA provider: Guest/Free users need setup
        if (llmProvider === 'NONA') {
          if (result.userTier === null || result.userTier === 'free') {
            shouldShowPrompt = true;
          }
        } else {
          // Non-NONA: Need BYOK configured
          if (result.source !== 'byok') {
            shouldShowPrompt = true;
          }
        }

        if (shouldShowPrompt) {
          console.log(`[useLLMAccess] Showing page entry prompt for ${pageId}`);
          sessionStorage.setItem(sessionKey, 'true');
          setShowPrompt(true);
        }
      } catch (error) {
        console.error('[useLLMAccess] Error checking on mount:', error);
      }
    };

    checkOnPageEntry();
  }, [checkOnMount, pageId, llmProvider]);

  /**
   * Check LLM access before performing an action.
   * Returns true if access is allowed, false if prompt is shown.
   *
   * Logic:
   * - NONA provider: Requires user to be logged in (uses backend proxy)
   * - Other providers: Requires BYOK key configured OR user logged in as PRO/GOLD
   */
  const checkAccess = useCallback(async (): Promise<boolean> => {
    try {
      // Call IPC to check access
      const response = await window.electronAPI.entitlement.canAccessLLMFeatures();

      if (!response.success || !response.data) {
        console.error('[useLLMAccess] Failed to check access:', response.error);
        // On error, allow action (fail-open for better UX)
        return true;
      }

      const result = response.data;
      setAccessResult(result);
      setUserTier(result.userTier);

      console.log('[useLLMAccess] Access check result:', result, 'provider:', llmProvider);

      // Case 1: PRO/GOLD users always have access (platform key)
      if (result.userTier === 'pro' || result.userTier === 'gold') {
        console.log('[useLLMAccess] PRO/GOLD user - access granted');
        return true;
      }

      // Case 2: Using NONA provider - requires login (backend proxy)
      if (llmProvider === 'NONA') {
        // Guest (null) or Free users need to login to use NONA
        if (result.userTier === null || result.userTier === 'free') {
          console.log('[useLLMAccess] NONA provider requires login for guest/free users');
          setShowPrompt(true);
          return false;
        }
        return true;
      }

      // Case 3: Using non-NONA provider - check BYOK configuration
      if (result.source === 'byok') {
        console.log('[useLLMAccess] BYOK configured - access granted');
        return true;
      }

      // Case 4: No BYOK configured for non-NONA provider
      console.log('[useLLMAccess] No BYOK configured for provider:', llmProvider);
      setShowPrompt(true);
      return false;
    } catch (error) {
      console.error('[useLLMAccess] Exception checking access:', error);
      // Fail-open
      return true;
    }
  }, [llmProvider]);

  const closePrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const openSettings = useCallback(() => {
    setShowPrompt(false);
    onOpenSettings?.();
  }, [onOpenSettings]);

  const triggerUpgrade = useCallback(() => {
    setShowPrompt(false);
    onUpgrade?.();
  }, [onUpgrade]);

  const triggerLogin = useCallback(() => {
    setShowPrompt(false);
    onLogin?.();
  }, [onLogin]);

  return {
    checkAccess,
    accessResult,
    showPrompt,
    userTier,
    closePrompt,
    openSettings,
    triggerUpgrade,
    triggerLogin,
  };
}

export default useLLMAccess;

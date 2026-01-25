/**
 * useGenerateWorkflow - Unified Generate Workflow Hook
 *
 * Consolidates the common "Start Generate" flow used by Builder pages:
 * 1. LLM access check
 * 2. Input validation
 * 3. NamingDialog
 * 4. API execution
 * 5. Algorithm storage
 * 6. Error handling
 *
 * @see TICKET_077_D2_UNIFIED_GENERATE_WORKFLOW.md
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLLMAccess, UseLLMAccessReturn } from './useLLMAccess';
import { useValidateBeforeGenerate } from '../components/ui/ValidateInputBeforeGenerate';
import {
  getAlgorithmStorageService,
  AlgorithmSaveRequest,
} from '../services';

// =============================================================================
// Types
// =============================================================================

/**
 * Generation result from API (common structure across all endpoints)
 */
export interface GenerationResult {
  status: 'completed' | 'failed' | 'rejected' | 'processing';
  strategy_code?: string;
  reason_code?: string;
  error?: string | { error_code?: string; error_message?: string; code?: string; message?: string };
}

/**
 * Internal generate result state
 */
export interface GenerateResultState {
  code?: string;
  error?: string;
}

/**
 * CodeDisplay state type
 */
export type CodeDisplayState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Workflow configuration - defines how the workflow behaves for a specific page
 */
export interface GenerateWorkflowConfig<TConfig, TState> {
  /** Page identifier for analytics and session tracking */
  pageId: string;

  /** LLM provider setting */
  llmProvider: string;

  /** LLM model setting */
  llmModel: string;

  /** Default strategy name */
  defaultStrategyName?: string;

  /** Validation error message */
  validationErrorMessage?: string;

  /** Build API config from current state and strategy name */
  buildConfig: (state: TState, strategyName: string) => TConfig;

  /** Validate config before API call */
  validateConfig: (config: TConfig) => { valid: boolean; error?: string };

  /** Execute API call */
  executeApi: (config: TConfig) => Promise<GenerationResult>;

  /** Build storage request from result */
  buildStorageRequest: (
    result: GenerationResult,
    state: TState,
    strategyName: string
  ) => AlgorithmSaveRequest;

  /** Error code to message mapping */
  errorMessages: Record<string, string>;

  /** Get user-friendly error message from result */
  getErrorMessage: (result: GenerationResult) => string;
}

/**
 * Workflow callbacks - optional handlers for workflow events
 */
export interface GenerateWorkflowCallbacks {
  /** Called on successful generation */
  onSuccess?: (code: string) => void;

  /** Called on generation error */
  onError?: (error: string) => void;

  /** Called when algorithm is saved */
  onSaved?: () => void;

  /** Open settings callback (for LLM access) */
  onSettingsClick?: () => void;
}

/**
 * Workflow state - returned by hook for UI binding
 */
export interface GenerateWorkflowState {
  /** Is generation in progress */
  isGenerating: boolean;

  /** Generation result */
  generateResult: GenerateResultState | null;

  /** Is naming dialog visible */
  namingDialogVisible: boolean;

  /** Is algorithm saved */
  isSaved: boolean;

  /** Current strategy name */
  strategyName: string;
}

/**
 * Workflow actions - returned by hook for UI interaction
 */
export interface GenerateWorkflowActions {
  /** Handle button click - starts the flow (access check -> validate -> dialog) */
  handleStartGenerate: () => Promise<void>;

  /** Handle naming dialog cancel */
  handleCancelNaming: () => void;

  /** Handle naming dialog confirm - triggers actual generation */
  handleConfirmNaming: (name: string) => void;

  /** Update strategy name (for sidebar input binding) */
  setStrategyName: (name: string) => void;

  /** Get CodeDisplay state */
  getCodeDisplayState: () => CodeDisplayState;

  /** Check if has previous successful result */
  hasResult: boolean;
}

/**
 * LLM access state subset - returned by hook for ApiKeyPrompt binding
 */
export interface GenerateWorkflowLLMAccess {
  showPrompt: boolean;
  userTier: string | null;
  closePrompt: () => void;
  openSettings: () => void;
  triggerUpgrade: () => void;
  triggerLogin: () => void;
}

/**
 * Full hook return type
 */
export interface UseGenerateWorkflowReturn {
  state: GenerateWorkflowState;
  actions: GenerateWorkflowActions;
  llmAccess: GenerateWorkflowLLMAccess;
  codeDisplayRef: React.RefObject<HTMLDivElement>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * useGenerateWorkflow
 *
 * Unified hook for the "Start Generate" flow in Builder pages.
 *
 * @param config - Workflow configuration (API executor, validators, etc.)
 * @param callbacks - Optional event callbacks
 * @param currentState - Current page state (passed to config builders)
 * @param validationItems - Items to validate (indicators, factors, expressions)
 *
 * @example
 * ```tsx
 * const { state, actions, llmAccess, codeDisplayRef } = useGenerateWorkflow(
 *   workflowConfig,
 *   { onSettingsClick },
 *   { selectedRegime, indicatorBlocks, factorBlocks, strategies, storageMode },
 *   allRules
 * );
 *
 * // Button
 * <button onClick={actions.handleStartGenerate}>
 *   {state.isGenerating ? 'Generating...' : actions.hasResult ? 'Regenerate' : 'Start Generate'}
 * </button>
 *
 * // NamingDialog
 * <NamingDialog
 *   visible={state.namingDialogVisible}
 *   onConfirm={actions.handleConfirmNaming}
 *   onCancel={actions.handleCancelNaming}
 * />
 *
 * // ApiKeyPrompt
 * <ApiKeyPrompt
 *   isOpen={llmAccess.showPrompt}
 *   userTier={llmAccess.userTier}
 *   onConfigure={llmAccess.openSettings}
 *   onUpgrade={llmAccess.triggerUpgrade}
 *   onLogin={llmAccess.triggerLogin}
 *   onDismiss={llmAccess.closePrompt}
 * />
 *
 * // CodeDisplay
 * <div ref={codeDisplayRef}>
 *   <CodeDisplay
 *     code={state.generateResult?.code || ''}
 *     state={actions.getCodeDisplayState()}
 *     errorMessage={state.generateResult?.error}
 *   />
 * </div>
 * ```
 */
export function useGenerateWorkflow<TConfig, TState>(
  config: GenerateWorkflowConfig<TConfig, TState>,
  callbacks: GenerateWorkflowCallbacks,
  currentState: TState,
  validationItems: unknown[]
): UseGenerateWorkflowReturn {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [strategyName, setStrategyName] = useState(
    config.defaultStrategyName || 'New Strategy'
  );
  const [isSaved, setIsSaved] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResultState | null>(null);
  const [namingDialogVisible, setNamingDialogVisible] = useState(false);

  // Ref for auto-scroll to code display
  const codeDisplayRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // LLM Access Hook
  // ---------------------------------------------------------------------------

  const llmAccessHook: UseLLMAccessReturn = useLLMAccess({
    llmProvider: config.llmProvider,
    checkOnMount: true,
    pageId: config.pageId,
    onOpenSettings: callbacks.onSettingsClick,
    onUpgrade: () => {
      console.log(`[GenerateWorkflow:${config.pageId}] Upgrade requested`);
      globalThis.nexus?.window?.openExternal?.('https://ai.silvonastream.com/pricing');
    },
    onLogin: () => {
      console.log(`[GenerateWorkflow:${config.pageId}] Login requested`);
      window.electronAPI.auth?.login();
    },
  });

  // ---------------------------------------------------------------------------
  // Validation Hook
  // ---------------------------------------------------------------------------

  const { validate } = useValidateBeforeGenerate({
    items: validationItems,
    errorMessage: config.validationErrorMessage || 'Please add at least one indicator, factor, or expression',
    onValidationFail: (message) => {
      console.warn(`[GenerateWorkflow:${config.pageId}] Validation failed:`, message);
      globalThis.nexus?.window?.showAlert(message);
    },
  });

  // ---------------------------------------------------------------------------
  // Auto-scroll Effect (TICKET_077_D3: scroll when generation starts)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Scroll to code display area when generation starts (not after completion)
    if (isGenerating && codeDisplayRef.current) {
      codeDisplayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [isGenerating]);

  // ---------------------------------------------------------------------------
  // CodeDisplay State Helper
  // ---------------------------------------------------------------------------

  const getCodeDisplayState = useCallback((): CodeDisplayState => {
    if (isGenerating) return 'loading';
    if (generateResult?.error) return 'error';
    if (generateResult?.code) return 'success';
    return 'idle';
  }, [isGenerating, generateResult]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Handle Start Generate button click
   * Flow: Access check -> Validation -> Show NamingDialog
   */
  const handleStartGenerate = useCallback(async () => {
    // Step 1: Check LLM access
    const hasAccess = await llmAccessHook.checkAccess();
    if (!hasAccess) {
      return;
    }

    // Step 2: Validate inputs
    if (!validate()) {
      return;
    }

    // Step 3: Show naming dialog
    setNamingDialogVisible(true);
  }, [llmAccessHook, validate]);

  /**
   * Handle naming dialog cancel
   */
  const handleCancelNaming = useCallback(() => {
    setNamingDialogVisible(false);
  }, []);

  /**
   * Handle naming dialog confirm - executes the actual generation
   */
  const handleConfirmNaming = useCallback(async (finalName: string) => {
    setNamingDialogVisible(false);
    setStrategyName(finalName);

    // Build API config
    const apiConfig = config.buildConfig(currentState, finalName);

    // Validate config
    const validation = config.validateConfig(apiConfig);
    if (!validation.valid) {
      console.warn(`[GenerateWorkflow:${config.pageId}] Config validation failed:`, validation.error);
      setGenerateResult({ error: validation.error });
      return;
    }

    // Set loading state
    setIsGenerating(true);
    setGenerateResult(null);

    try {
      console.debug(`[GenerateWorkflow:${config.pageId}] Calling API...`);
      const result = await config.executeApi(apiConfig);

      console.log(`[GenerateWorkflow:${config.pageId}] API result status:`, result.status);
      console.log(`[GenerateWorkflow:${config.pageId}] strategy_code length:`, result.strategy_code?.length);

      if (result.status === 'completed' && result.strategy_code) {
        // Success
        console.log(`[GenerateWorkflow:${config.pageId}] Generation successful`);
        setGenerateResult({ code: result.strategy_code });
        callbacks.onSuccess?.(result.strategy_code);

        // Save algorithm
        try {
          console.log(`[GenerateWorkflow:${config.pageId}] Saving algorithm...`);
          const storageService = getAlgorithmStorageService();
          const saveRequest = config.buildStorageRequest(result, currentState, finalName);
          const saveResult = await storageService.save(saveRequest);

          if (saveResult.success) {
            console.log(`[GenerateWorkflow:${config.pageId}] Algorithm saved:`, saveResult.data);
            setIsSaved(true);
            callbacks.onSaved?.();
          } else {
            console.error(`[GenerateWorkflow:${config.pageId}] Save failed:`, saveResult.error);
          }
        } catch (saveError) {
          console.error(`[GenerateWorkflow:${config.pageId}] Save exception:`, saveError);
        }
      } else if (result.status === 'failed' || result.status === 'rejected') {
        // API returned error
        const errorMsg = config.getErrorMessage(result);
        console.error(`[GenerateWorkflow:${config.pageId}] Generation failed:`, result.reason_code || result.error);
        setGenerateResult({ error: errorMsg });
        globalThis.nexus?.window?.showAlert(errorMsg);
        callbacks.onError?.(errorMsg);
      } else {
        // Unexpected status
        setGenerateResult({ error: 'Unexpected result status' });
      }
    } catch (error) {
      // Exception during API call
      console.error(`[GenerateWorkflow:${config.pageId}] Exception:`, error);

      const err = error as Error & { code?: string; reasonCode?: string };
      const errorCode = err.code || err.reasonCode;
      console.error(`[GenerateWorkflow:${config.pageId}] Error code:`, errorCode, 'Message:', err.message);

      // AUTH_REQUIRED already shows modal in api-client, skip duplicate
      if (err.message === 'AUTH_REQUIRED') {
        setGenerateResult({ error: 'Please log in to continue' });
        return;
      }

      // Map error code to user-friendly message
      let errorMsg: string;
      if (errorCode && config.errorMessages[errorCode]) {
        errorMsg = config.errorMessages[errorCode];
      } else {
        errorMsg = err.message || 'Unknown error';
      }

      console.log(`[GenerateWorkflow:${config.pageId}] Final error message:`, errorMsg);
      setGenerateResult({ error: errorMsg });
      globalThis.nexus?.window?.showAlert(errorMsg);
      callbacks.onError?.(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [config, currentState, callbacks]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state: {
      isGenerating,
      generateResult,
      namingDialogVisible,
      isSaved,
      strategyName,
    },
    actions: {
      handleStartGenerate,
      handleCancelNaming,
      handleConfirmNaming,
      setStrategyName,
      getCodeDisplayState,
      hasResult: Boolean(generateResult?.code),
    },
    llmAccess: {
      showPrompt: llmAccessHook.showPrompt,
      userTier: llmAccessHook.userTier,
      closePrompt: llmAccessHook.closePrompt,
      openSettings: llmAccessHook.openSettings,
      triggerUpgrade: llmAccessHook.triggerUpgrade,
      triggerLogin: llmAccessHook.triggerLogin,
    },
    codeDisplayRef,
  };
}

export default useGenerateWorkflow;

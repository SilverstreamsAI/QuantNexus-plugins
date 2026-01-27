/**
 * Kronos AI Entry Service - Plugin Layer
 *
 * TICKET_211: Kronos AI Entry Page
 *
 * Uses: /api/kronos_llm_entry for LLM-powered entry signal generation
 *
 * Key difference from Kronos Indicator Entry:
 * - Uses preset modes (Baseline/Monk/Warrior/Bespoke) instead of indicator rules
 * - Uses prompt-based generation with LLM
 * - Optional raw indicator context
 *
 * @see TICKET_211 - Kronos AI Entry Page
 * @see TICKET_077_19 - Kronos AI Entry Components
 * @see TICKET_202 - Builder Page Base Class Mapping
 */

import { pluginApiClient, ApiResponse } from './api-client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/kronos_llm_entry',
  STATUS: '/api/check_kronos_llm_entry_status',
};

// -----------------------------------------------------------------------------
// Public Types (used by KronosAIEntryPage)
// -----------------------------------------------------------------------------

/**
 * Trader preset mode
 */
export type TraderPresetMode = 'baseline' | 'monk' | 'warrior' | 'bespoke';

/**
 * Bespoke configuration parameters
 */
export interface BespokeConfig {
  lookbackBars: number;
  positionLimits: number;
  leverage: number;
  tradingFrequency: number;
  typicalYield: number;
  maxDrawdown: number;
}

/**
 * Raw indicator block for context
 */
export interface RawIndicatorBlock {
  id: string;
  indicatorSlug: string | null;
  paramValues: Record<string, number | string>;
}

/**
 * Kronos AI Entry configuration (client format)
 */
export interface KronosAIEntryConfig {
  strategy_name: string;
  preset_mode: TraderPresetMode;
  bespoke_config?: BespokeConfig;
  prompt: string;
  indicators: RawIndicatorBlock[];
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
}

/**
 * Kronos AI Entry result
 */
export interface KronosAIEntryResult {
  status: 'completed' | 'failed' | 'processing' | 'rejected';
  validation_status?: 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';
  reason_code?: string;
  strategy_code?: string;
  class_name?: string;
  error?: {
    error_code?: string;
    error_message?: string;
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Error code to user-friendly message mapping
 */
export const KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES: Record<string, string> = {
  SECURITY_VIOLATION: 'Security violation detected. Please check your input.',
  INVALID: 'Invalid input detected. Please check your configuration.',
  INVALID_PROMPT: 'Invalid prompt. Please provide a valid trading strategy description.',
  PROMPT_TOO_SHORT: 'Prompt is too short. Please provide more details.',
  PROMPT_TOO_LONG: 'Prompt is too long. Please shorten your description.',
  INVALID_PRESET: 'Invalid preset mode selected.',
  INVALID_BESPOKE_CONFIG: 'Invalid bespoke configuration values.',
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TASK_FAILED: 'Task processing failed. Please try again later.',
  LLM_ERROR: 'AI model encountered an error. Please try again.',
  LLM_RATE_LIMIT: 'AI service rate limit exceeded. Please wait and try again.',
  LLM_CONTEXT_LENGTH: 'Prompt exceeds AI model context length. Please shorten your description.',
  GENERATION_FAILED: 'Code generation failed. Please review your configuration.',
  SPEC_NOT_TRADING_ALGORITHM: 'Input is not related to trading strategy.',
  UNSUPPORTED_PROVIDER: 'Selected LLM provider is not supported.',
};

/**
 * Get user-friendly error message from error response
 */
export function getKronosAIEntryErrorMessage(result: KronosAIEntryResult): string {
  if (result.reason_code && KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.reason_code]) {
    return KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.error.error_code]) {
    return KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.error.code]) {
    return KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES[result.error.code];
  }

  if (result.error?.error_message) {
    return result.error.error_message;
  }

  if (result.error?.message) {
    return result.error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// -----------------------------------------------------------------------------
// Server Request Types (matches /api/kronos_llm_entry format)
// -----------------------------------------------------------------------------

/**
 * Preset mode configuration for server
 */
interface ServerPresetConfig {
  mode: TraderPresetMode;
  bespoke_params?: {
    lookback_bars: number;
    position_limits: number;
    leverage: number;
    trading_frequency: number;
    typical_yield: number;
    max_drawdown: number;
  };
}

/**
 * Server indicator context format
 */
interface ServerIndicatorContext {
  slug: string;
  name: string;
  params: Record<string, unknown>;
}

/**
 * Server request format for /api/kronos_llm_entry
 */
interface ServerRequest {
  user_id: number;
  task_id?: string;
  locale?: string;
  kronos_llm_entry_config: {
    strategy_name: string;
    preset_config: ServerPresetConfig;
    analysis_prompt: string;
    indicator_context: ServerIndicatorContext[];
    entry_signal_base: 'kronos'; // Always "kronos" for Kronos mode
    llm_provider?: string;
    llm_model?: string;
  };
  llm_provider?: string;
  llm_model?: string;
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

/**
 * Transform bespoke config to server format
 */
function transformBespokeConfig(config: BespokeConfig): ServerPresetConfig['bespoke_params'] {
  return {
    lookback_bars: config.lookbackBars,
    position_limits: config.positionLimits,
    leverage: config.leverage,
    trading_frequency: config.tradingFrequency,
    typical_yield: config.typicalYield,
    max_drawdown: config.maxDrawdown,
  };
}

/**
 * Transform raw indicator blocks to server format
 */
function transformIndicatorContext(blocks: RawIndicatorBlock[]): ServerIndicatorContext[] {
  return blocks
    .filter(block => block.indicatorSlug)
    .map(block => ({
      slug: block.indicatorSlug!,
      name: block.indicatorSlug!,
      params: block.paramValues as Record<string, unknown>,
    }));
}

/**
 * Build server request from client config
 */
function buildServerRequest(config: KronosAIEntryConfig): ServerRequest {
  // Build preset config
  const presetConfig: ServerPresetConfig = {
    mode: config.preset_mode,
  };

  // Add bespoke params if bespoke mode
  if (config.preset_mode === 'bespoke' && config.bespoke_config) {
    presetConfig.bespoke_params = transformBespokeConfig(config.bespoke_config);
  }

  // Generate task_id
  const taskId = `kronos_ai_entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    user_id: 1,
    task_id: taskId,
    locale: 'en_US',
    kronos_llm_entry_config: {
      strategy_name: config.strategy_name || 'Untitled Kronos AI Strategy',
      preset_config: presetConfig,
      analysis_prompt: config.prompt,
      indicator_context: transformIndicatorContext(config.indicators),
      entry_signal_base: 'kronos',
      llm_provider: config.llm_provider || 'NONA',
      llm_model: config.llm_model || 'nona-nexus',
    },
    llm_provider: config.llm_provider || 'NONA',
    llm_model: config.llm_model || 'nona-nexus',
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute Kronos AI Entry generation
 *
 * TICKET_211: Calls /api/kronos_llm_entry which generates
 * KronosAIEntryBase strategies using LLM-powered prompt analysis.
 */
export async function executeKronosAIEntry(
  config: KronosAIEntryConfig
): Promise<KronosAIEntryResult> {
  const requestPayload = buildServerRequest(config);

  console.debug('[KronosAIEntry] Calling API:', API_ENDPOINTS.START);
  console.debug('[KronosAIEntry] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<KronosAIEntryResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse;
      const status = resp.data?.status;
      const isComplete = status === 'completed' || status === 'failed' || status === 'rejected';

      console.debug('[KronosAIEntry] Poll response:', JSON.stringify(resp, null, 2).substring(0, 2000));

      // Result is directly under data.result
      const result = resp.data?.result as Record<string, unknown> | undefined;

      return {
        isComplete,
        result: {
          status: status as KronosAIEntryResult['status'],
          validation_status: result?.validation_status as KronosAIEntryResult['validation_status'],
          reason_code: result?.reason_code as string | undefined,
          strategy_code: result?.strategy_code as string | undefined,
          class_name: result?.class_name as string | undefined,
          error: result?.error as KronosAIEntryResult['error'],
        } as KronosAIEntryResult,
        rawResponse: response,
      };
    },
  });
}

/**
 * Validate Kronos AI Entry configuration
 */
export function validateKronosAIEntryConfig(
  config: Partial<KronosAIEntryConfig>
): { valid: boolean; error?: string } {
  // Prompt is required
  if (!config.prompt || config.prompt.trim().length < 10) {
    return { valid: false, error: 'Please enter a prompt (at least 10 characters)' };
  }

  // Prompt max length check
  if (config.prompt.length > 10000) {
    return { valid: false, error: 'Prompt is too long (max 10000 characters)' };
  }

  // Preset mode must be valid
  const validModes: TraderPresetMode[] = ['baseline', 'monk', 'warrior', 'bespoke'];
  if (config.preset_mode && !validModes.includes(config.preset_mode)) {
    return { valid: false, error: 'Invalid preset mode selected' };
  }

  // Bespoke config validation
  if (config.preset_mode === 'bespoke' && config.bespoke_config) {
    const bc = config.bespoke_config;

    if (bc.lookbackBars < 20 || bc.lookbackBars > 200) {
      return { valid: false, error: 'Lookback bars must be between 20 and 200' };
    }

    if (bc.positionLimits < 0 || bc.positionLimits > 100) {
      return { valid: false, error: 'Position limits must be between 0% and 100%' };
    }

    if (bc.leverage < 1 || bc.leverage > 1000) {
      return { valid: false, error: 'Leverage must be between 1x and 1000x' };
    }

    if (bc.tradingFrequency < 1 || bc.tradingFrequency > 1000) {
      return { valid: false, error: 'Trading frequency must be between 1 and 1000' };
    }

    if (bc.typicalYield < 1 || bc.typicalYield > 500) {
      return { valid: false, error: 'Typical yield must be between 1% and 500%' };
    }

    if (bc.maxDrawdown < 1 || bc.maxDrawdown > 90) {
      return { valid: false, error: 'Max drawdown must be between 1% and 90%' };
    }
  }

  return { valid: true };
}

/**
 * Get default bespoke config
 */
export function getDefaultBespokeConfig(): BespokeConfig {
  return {
    lookbackBars: 100,
    positionLimits: 100,
    leverage: 1,
    tradingFrequency: 10,
    typicalYield: 50,
    maxDrawdown: 20,
  };
}

/**
 * Get preset mode description
 */
export function getPresetModeDescription(mode: TraderPresetMode): string {
  const descriptions: Record<TraderPresetMode, string> = {
    baseline: 'Maximize absolute returns without extra constraints',
    monk: 'Strict discipline, stability, and risk-adjusted returns',
    warrior: 'Aggressive assault with high leverage and risk',
    bespoke: 'Fully customized strategy tailored to your needs',
  };
  return descriptions[mode] || '';
}

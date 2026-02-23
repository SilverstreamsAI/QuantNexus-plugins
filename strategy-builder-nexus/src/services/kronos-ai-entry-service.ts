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
import { getCurrentUserId } from '../utils/auth-utils';

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
  field: string;
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
  strategy_id?: number;
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
 * Server raw indicator format
 */
interface ServerRawIndicator {
  type: 'raw_indicator';
  indicator_slug: string;
  field: string;
  parameters: Record<string, unknown>;
  output_name: string;
}

/**
 * Server LLM configuration
 */
interface ServerLLMConfig {
  provider: string;
  model: string;
  timeout: number;
  retries: number;
  prompt: string;
}

/**
 * Server Kronos configuration
 */
interface ServerKronosConfig {
  confidenceThreshold: number;
  expectedReturnThreshold: number;
  directionFilter: boolean;
}

/**
 * Server request format for /api/kronos_llm_entry
 */
interface ServerRequest {
  user_id: number;
  task_id?: string;
  locale?: string;
  output_format?: 'v1' | 'v3'; // TICKET_223: V3 framework import format
  storage_mode: 'local' | 'remote' | 'hybrid';
  operation_type: 'generate_strategy';
  operation_data: {
    strategy_id?: number;
    strategy_name: string;
    prediction: {
      lookbackBars: number;
    };
    llm: ServerLLMConfig;
    rawIndicators: ServerRawIndicator[];
    kronosConfig: ServerKronosConfig;
  };
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

/**
 * Default lookback bars by preset mode
 */
const PRESET_LOOKBACK_BARS: Record<TraderPresetMode, number> = {
  baseline: 100,
  monk: 150,
  warrior: 50,
  bespoke: 100, // Will be overridden by bespoke_config.lookbackBars
};

/**
 * Default Kronos config by preset mode
 */
const PRESET_KRONOS_CONFIG: Record<TraderPresetMode, ServerKronosConfig> = {
  baseline: {
    confidenceThreshold: 0.5,
    expectedReturnThreshold: 0.01,
    directionFilter: true,
  },
  monk: {
    confidenceThreshold: 0.7,
    expectedReturnThreshold: 0.03,
    directionFilter: true,
  },
  warrior: {
    confidenceThreshold: 0.3,
    expectedReturnThreshold: 0.005,
    directionFilter: false,
  },
  bespoke: {
    confidenceThreshold: 0.6,
    expectedReturnThreshold: 0.02,
    directionFilter: true,
  },
};

/**
 * Transform raw indicator blocks to server format
 */
function transformRawIndicators(blocks: RawIndicatorBlock[]): ServerRawIndicator[] {
  return blocks
    .filter(block => block.indicatorSlug)
    .map((block, index) => ({
      type: 'raw_indicator' as const,
      indicator_slug: block.indicatorSlug!,
      field: block.field,
      parameters: block.paramValues as Record<string, unknown>,
      output_name: `${block.indicatorSlug!.toLowerCase()}_${index}`,
    }));
}

/**
 * Build server request from client config
 */
function buildServerRequest(config: KronosAIEntryConfig, userId: number): ServerRequest {
  // Determine lookback bars
  const lookbackBars = config.preset_mode === 'bespoke' && config.bespoke_config
    ? config.bespoke_config.lookbackBars
    : PRESET_LOOKBACK_BARS[config.preset_mode];

  // Get Kronos config for preset mode
  const kronosConfig = PRESET_KRONOS_CONFIG[config.preset_mode];

  // Generate task_id
  const taskId = `kronos_llm_entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    user_id: userId,
    task_id: taskId,
    locale: 'en_US',
    output_format: 'v3', // TICKET_223: V3 framework import format
    storage_mode: config.storage_mode || 'local',
    operation_type: 'generate_strategy',
    operation_data: {
      strategy_name: config.strategy_name || 'Untitled Kronos AI Strategy',
      prediction: {
        lookbackBars,
      },
      llm: {
        provider: config.llm_provider || 'NONA',
        model: config.llm_model || 'nona-default',
        timeout: 60,
        retries: 5,
        prompt: config.prompt,
      },
      rawIndicators: transformRawIndicators(config.indicators),
      kronosConfig,
    },
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
  const userId = await getCurrentUserId();
  const requestPayload = buildServerRequest(config, userId);

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
          strategy_id: result?.strategy_id as number | undefined,
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

  // TICKET_396: Validate rawIndicators field completeness
  const validFields = ['close', 'open', 'high', 'low', 'volume'];
  if (config.indicators && config.indicators.length > 0) {
    for (const block of config.indicators) {
      if (block.indicatorSlug && !block.field) {
        return { valid: false, error: 'Each indicator requires a data field selection (close/open/high/low/volume)' };
      }
      if (block.field && !validFields.includes(block.field)) {
        return { valid: false, error: `Invalid data field "${block.field}". Must be one of: ${validFields.join(', ')}` };
      }
    }
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

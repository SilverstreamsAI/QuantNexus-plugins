/**
 * Kronos Indicator Entry Service - Plugin Layer
 *
 * TICKET_208: Kronos Indicator Entry Page Migration
 *
 * Uses: /api/start_kronos_indicator_entry (NOT /api/start_regime_indicator_entry)
 *
 * Key difference from Regime Indicator Entry:
 * - NO entry_signal_base (market regime) parameter
 * - Uses KronosIndicatorEntryBase as strategy base class
 *
 * @see TICKET_208 - Kronos Indicator Entry Page Migration
 * @see TICKET_202 - Builder Page Base Class Mapping
 */

import { pluginApiClient, ApiResponse } from './api-client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/start_kronos_indicator_entry',
  STATUS: '/api/check_kronos_indicator_entry_status',
};

// -----------------------------------------------------------------------------
// Public Types (used by KronosIndicatorEntryPage)
// -----------------------------------------------------------------------------

export interface KronosIndicatorEntryConfig {
  strategy_name: string;
  rules: KronosIndicatorRule[];
  // NO entry_signal_base - Kronos does not use market regime
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
}

export interface KronosIndicatorRule {
  rule_type: 'template_based' | 'custom_expression' | 'factor_based';
  indicator?: {
    slug: string;
    name: string;
    params?: Record<string, unknown>;
  };
  strategy?: {
    logic: {
      type?: string;
      operator?: string;
      threshold_value?: string | number;
      line1?: string;
      line2?: string;
    };
    params?: Record<string, unknown>;
  };
  expression?: string;
  factor?: {
    name: string;
    category: string;
    params?: Record<string, unknown>;
  };
}

export interface KronosIndicatorEntryResult {
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
export const KRONOS_ENTRY_ERROR_CODE_MESSAGES: Record<string, string> = {
  SECURITY_VIOLATION: 'Security violation detected. Please check your input.',
  INVALID: 'Invalid input detected. Please check your configuration.',
  SYNTAX_ERROR: 'Syntax error in your expression.',
  UNKNOWN_INDICATOR: 'Unknown indicator specified.',
  UNSUPPORTED_OPERATOR: 'Unsupported operator in expression.',
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TASK_FAILED: 'Task processing failed. Please try again later.',
  LLM_ERROR: 'AI model encountered an error. Please try again.',
  GENERATION_FAILED: 'Code generation failed. Please review your configuration.',
  SPEC_NOT_TRADING_ALGORITHM: 'Input is not related to trading strategy.',
};

/**
 * Get user-friendly error message from error response
 */
export function getKronosEntryErrorMessage(result: KronosIndicatorEntryResult): string {
  if (result.reason_code && KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.reason_code]) {
    return KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.error.error_code]) {
    return KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.error.code]) {
    return KRONOS_ENTRY_ERROR_CODE_MESSAGES[result.error.code];
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
// Server Request Types (matches /api/start_kronos_indicator_entry format)
// -----------------------------------------------------------------------------

/**
 * Server indicator rule format
 */
interface ServerIndicatorRule {
  indicator: {
    slug: string;
    name: string;
    params: Record<string, unknown>;
  };
  strategy: {
    type: string;
    label?: string;
    logic: {
      operator?: string;
      threshold_value?: string | number;
      line1?: string;
      line2?: string;
    };
  };
}

/**
 * Server request format for /api/start_kronos_indicator_entry
 * NOTE: Backend expects `indicator_entry_config` (not `kronos_indicator_entry_config`)
 */
interface ServerRequest {
  user_id: number;
  task_id?: string;
  output_format?: 'v1' | 'v3'; // TICKET_223: V3 framework import format
  storage_mode: 'local' | 'remote' | 'hybrid';
  indicator_entry_config: {
    locale?: string;
    longEntryIndicators: ServerIndicatorRule[];
    shortEntryIndicators: ServerIndicatorRule[];
    strategy_name: string;
    entry_signal_base: 'kronos'; // Always "kronos" for this API
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
 * Transform UI indicator rule to server format
 */
function transformRule(rule: KronosIndicatorRule): ServerIndicatorRule | null {
  // Only template_based rules are supported for now
  if (rule.rule_type !== 'template_based') {
    console.warn('[KronosIndicatorEntry] Skipping non-template rule:', rule.rule_type);
    return null;
  }

  if (!rule.indicator?.slug) {
    console.warn('[KronosIndicatorEntry] Skipping rule without indicator slug');
    return null;
  }

  const strategyType = rule.strategy?.logic?.type || 'threshold_level';

  // Build logic based on strategy type
  let logic: ServerIndicatorRule['strategy']['logic'];
  if (strategyType === 'crossover') {
    logic = {
      line1: rule.strategy?.logic?.line1 || 'price',
      operator: rule.strategy?.logic?.operator || '>',
      line2: rule.strategy?.logic?.line2 || 'indicator',
    };
  } else {
    // threshold_level or other types
    logic = {
      operator: rule.strategy?.logic?.operator || '>',
      threshold_value: rule.strategy?.logic?.threshold_value ?? 0,
    };
  }

  return {
    indicator: {
      slug: rule.indicator.slug,
      name: rule.indicator.name || rule.indicator.slug,
      params: (rule.indicator.params || {}) as Record<string, unknown>,
    },
    strategy: {
      type: strategyType,
      logic,
    },
  };
}

/**
 * Build server request from client config
 */
function buildServerRequest(config: KronosIndicatorEntryConfig): ServerRequest {
  // Transform all rules to server format
  const serverRules: ServerIndicatorRule[] = [];

  for (const rule of config.rules) {
    const transformed = transformRule(rule);
    if (transformed) {
      serverRules.push(transformed);
    }
  }

  // Generate task_id
  const taskId = `kronos_indicator_entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    user_id: 1,
    task_id: taskId,
    output_format: 'v3', // TICKET_223: V3 framework import format
    storage_mode: config.storage_mode || 'local',
    indicator_entry_config: {
      locale: 'en_US',
      longEntryIndicators: serverRules,
      shortEntryIndicators: [],
      strategy_name: config.strategy_name || 'Untitled Kronos Entry Strategy',
      entry_signal_base: 'kronos', // Always "kronos" for Kronos Indicator Entry
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
 * Execute Kronos Indicator Entry generation
 *
 * TICKET_208: Calls /api/start_kronos_indicator_entry which generates
 * KronosIndicatorEntryBase strategies for time-series prediction enhancement.
 */
export async function executeKronosIndicatorEntry(
  config: KronosIndicatorEntryConfig
): Promise<KronosIndicatorEntryResult> {
  const requestPayload = buildServerRequest(config);

  console.debug('[KronosIndicatorEntry] Calling API:', API_ENDPOINTS.START);
  console.debug('[KronosIndicatorEntry] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<KronosIndicatorEntryResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse;
      const status = resp.data?.status;
      const isComplete = status === 'completed' || status === 'failed' || status === 'rejected';

      console.debug('[KronosIndicatorEntry] Poll response:', JSON.stringify(resp, null, 2).substring(0, 2000));

      // TICKET_208: Result is directly under data.result (not nested in kronos_indicator_entry_result)
      // Response format: { success: true, data: { status: "completed", result: { strategy_code, class_name, ... } } }
      const result = resp.data?.result as Record<string, unknown> | undefined;

      return {
        isComplete,
        result: {
          status: status as KronosIndicatorEntryResult['status'],
          validation_status: result?.validation_status as KronosIndicatorEntryResult['validation_status'],
          reason_code: result?.reason_code as string | undefined,
          strategy_code: result?.strategy_code as string | undefined,
          class_name: result?.class_name as string | undefined,
          error: result?.error as KronosIndicatorEntryResult['error'],
        } as KronosIndicatorEntryResult,
        rawResponse: response,
      };
    },
  });
}

/**
 * Validate Kronos Indicator Entry configuration
 */
export function validateKronosIndicatorEntryConfig(
  config: Partial<KronosIndicatorEntryConfig>
): { valid: boolean; error?: string } {
  if (!config.rules || config.rules.length === 0) {
    return { valid: false, error: 'At least one indicator rule is required' };
  }

  for (const rule of config.rules) {
    if (rule.rule_type === 'template_based') {
      if (!rule.indicator?.slug) {
        return { valid: false, error: 'Template rule requires indicator' };
      }
    } else if (rule.rule_type === 'custom_expression') {
      if (!rule.expression || rule.expression.length < 3) {
        return { valid: false, error: 'Custom expression must be at least 3 characters' };
      }
    } else if (rule.rule_type === 'factor_based') {
      if (!rule.factor?.name) {
        return { valid: false, error: 'Factor rule requires factor name' };
      }
    }
  }

  return { valid: true };
}

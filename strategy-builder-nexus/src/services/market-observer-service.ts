/**
 * Market Observer Service - Plugin Layer
 *
 * Provides market observation and watchlist precondition functionality.
 * Part of Trader Mode in Strategy Builder.
 *
 * @see TICKET_077_1 - Page 35 (MarketObserverPage)
 * @see TICKET_202 - Builder Page Base Class Mapping
 * @see TICKET_211 - Market Observer API Integration
 * @see ISSUE_7016 - Market Observer API Protocol Specification
 */

import { pluginApiClient, ApiResponse } from './api-client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/start_watchlist_operation',
  STATUS: '/api/check_watchlist_operation_status',
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MarketObserverConfig {
  rules: MarketObserverRule[];
  strategy_name?: string;
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
}

export interface MarketObserverRule {
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
    };
  };
  expression?: string;
  factor?: {
    name: string;
    category: string;
    params?: Record<string, unknown>;
  };
}

export interface MarketObserverResult {
  status: 'completed' | 'failed' | 'processing' | 'rejected';
  validation_status?: 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';
  reason_code?: string;
  strategy_code?: string;
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
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Security violations
  SECURITY_VIOLATION: 'Security violation detected. Please check your input for potentially harmful content.',

  // Validation errors
  INVALID: 'Invalid input detected. Please check your configuration.',
  SYNTAX_ERROR: 'Syntax error in your expression. Please check bracket matching and operator usage.',
  UNKNOWN_INDICATOR: 'Unknown indicator specified. Please use supported indicators.',
  UNSUPPORTED_OPERATOR: 'Unsupported operator in expression.',

  // Network/System errors
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TASK_FAILED: 'Task processing failed. Please try again later.',

  // LLM errors
  LLM_ERROR: 'AI model encountered an error. Please try again.',
  GENERATION_FAILED: 'Code generation failed. Please review your configuration.',
};

/**
 * Get user-friendly error message from error response
 */
export function getErrorMessage(result: MarketObserverResult): string {
  if (result.reason_code && ERROR_CODE_MESSAGES[result.reason_code]) {
    return ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && ERROR_CODE_MESSAGES[result.error.error_code]) {
    return ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && ERROR_CODE_MESSAGES[result.error.code]) {
    return ERROR_CODE_MESSAGES[result.error.code];
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
// Request Builder Types (ISSUE_7016 Protocol)
// -----------------------------------------------------------------------------

/**
 * Server request format per ISSUE_7016
 * - symbol, item_type, strategy_name, condition_type in operation_data
 * - llm_provider, llm_model, temporary_api_key, storage_mode at top level
 */
interface ServerRequest {
  user_id: number;
  output_format?: 'v1' | 'v3'; // TICKET_220: V3 framework import format
  operation_type: 'add_item' | 'remove_item' | 'add_alert' | 'get_list' | 'get_item';
  locale: string;
  llm_provider: string;
  llm_model: string;
  temporary_api_key?: string;
  storage_mode: 'local' | 'remote' | 'hybrid';
  operation_data: {
    symbol: string;
    item_type: 'CRYPTO' | 'STOCK' | 'FUND';
    strategy_name: string;
    condition_type: 'indicator' | 'expression';
    // Mode 1: Structured indicator
    indicator?: {
      name: string;
      slug: string;
      params?: Record<string, unknown>;
    };
    strategy?: {
      type: string;
      description?: string;
    };
    // Mode 2: Expression
    expression?: string;
  };
}

// -----------------------------------------------------------------------------
// Request Builder (ISSUE_7016 Protocol)
// -----------------------------------------------------------------------------

/**
 * Map templateKey to backend strategy.type
 * Backend supports: threshold_level, crossover, band_break, indicator_crossover,
 *                   boundary_comparison, pattern_detected
 * @see strategy-templates-library.json
 */
const TEMPLATE_KEY_TO_TYPE: Record<string, string> = {
  // threshold_level
  threshold_simple: 'threshold_level',
  volatility_threshold: 'threshold_level',
  volume_spike: 'threshold_level',
  // crossover
  crossover_price_indicator: 'crossover',
  crossover_fast_slow_ma: 'crossover',
  // boundary_comparison
  boundary_comparison_oscillator: 'boundary_comparison',
  // band_break
  band_break_bollinger: 'band_break',
  // pattern_detected
  pattern_recognition: 'pattern_detected',
};

/**
 * Convert templateKey to backend strategy.type
 */
function mapTemplateKeyToType(templateKey: string | undefined): string {
  if (!templateKey) return 'threshold_level';
  return TEMPLATE_KEY_TO_TYPE[templateKey] || templateKey;
}

/**
 * Build expression string from rules for expression mode
 */
function buildExpressionFromRules(rules: MarketObserverRule[]): string {
  const parts = rules.map((rule) => {
    if (rule.rule_type === 'custom_expression') {
      return rule.expression || '';
    }

    if (rule.rule_type === 'factor_based') {
      const factor = rule.factor;
      const paramsStr = factor?.params
        ? Object.entries(factor.params).map(([k, v]) => `${k}=${v}`).join(', ')
        : '';
      return paramsStr ? `${factor?.name}(${paramsStr})` : factor?.name || '';
    }

    // template_based: build indicator expression
    const indicator = rule.indicator;
    const logic = rule.strategy?.logic;
    const paramsStr = indicator?.params
      ? Object.entries(indicator.params).map(([k, v]) => `${k}=${v}`).join(', ')
      : '';
    const indicatorPart = paramsStr ? `${indicator?.slug}(${paramsStr})` : indicator?.slug;
    const logicStr = logic?.operator && logic?.threshold_value !== undefined
      ? `${logic.operator} ${logic.threshold_value}`
      : '';

    return logicStr ? `${indicatorPart} ${logicStr}` : indicatorPart || '';
  });

  return parts.filter(Boolean).join(' AND ');
}

/**
 * Determine condition type based on rules
 * - Single template_based rule -> indicator mode
 * - Multiple rules or custom_expression -> expression mode
 */
function determineConditionType(rules: MarketObserverRule[]): 'indicator' | 'expression' {
  if (rules.length === 1 && rules[0].rule_type === 'template_based') {
    return 'indicator';
  }
  return 'expression';
}

/**
 * Resolve API key for the selected provider and model
 */
async function resolveApiKeyForProvider(providerId: string, modelId: string): Promise<string | undefined> {
  if (modelId === 'nona-nexus') {
    return undefined;
  }

  try {
    let keyProviderId = providerId;
    if (providerId === 'NONA') {
      keyProviderId = mapModelToProvider(modelId);
    }

    const result = await window.electronAPI.entitlement.resolveLLMApiKey(keyProviderId);
    if (result.success && result.data?.key) {
      return result.data.key;
    }
    return undefined;
  } catch (error) {
    console.error(`[MarketObserverService] Failed to resolve API key:`, error);
    return undefined;
  }
}

function mapModelToProvider(modelId: string): string {
  if (modelId.startsWith('gpt-') || modelId.startsWith('o3-')) return 'OPENAI';
  if (modelId.startsWith('claude-')) return 'CLAUDE';
  if (modelId.startsWith('gemini-')) return 'GEMINI';
  if (modelId.startsWith('deepseek-')) return 'DEEPSEEK';
  if (modelId.startsWith('grok-')) return 'GROK';
  if (modelId.startsWith('qwen')) return 'QWEN';
  return 'NONA';
}

/**
 * Build server request per ISSUE_7016 protocol
 * - symbol, item_type in operation_data
 * - llm_provider, llm_model, storage_mode at top level
 */
function buildServerRequest(config: MarketObserverConfig, apiKey?: string): ServerRequest {
  const conditionType = determineConditionType(config.rules);
  const strategyName = config.strategy_name || 'Untitled Observer';

  // Build operation_data
  const operationData: ServerRequest['operation_data'] = {
    symbol: 'BTC/USDT',
    item_type: 'CRYPTO',
    strategy_name: strategyName,
    condition_type: conditionType,
  };

  if (conditionType === 'indicator' && config.rules.length === 1) {
    // Single indicator mode
    const rule = config.rules[0];
    operationData.indicator = {
      name: rule.indicator?.name || rule.indicator?.slug || '',
      slug: rule.indicator?.slug || '',
      params: rule.indicator?.params,
    };
    operationData.strategy = {
      type: mapTemplateKeyToType(rule.strategy?.logic?.type),
      description: `${rule.strategy?.logic?.operator || '>'} ${rule.strategy?.logic?.threshold_value ?? 0}`,
    };
  } else {
    // Expression mode - combine all rules
    operationData.expression = buildExpressionFromRules(config.rules);
  }

  return {
    user_id: 1,
    output_format: 'v3', // TICKET_220: V3 framework import format
    operation_type: 'add_item',
    locale: 'en',
    llm_provider: config.llm_provider || 'NONA',
    llm_model: config.llm_model || 'nona-nexus',
    temporary_api_key: apiKey,
    storage_mode: config.storage_mode || 'local',
    operation_data: operationData,
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute market observer generation
 */
export async function executeMarketObserverGeneration(
  config: MarketObserverConfig
): Promise<MarketObserverResult> {
  const providerId = config.llm_provider || 'NONA';
  const modelId = config.llm_model || 'nona-nexus';
  const apiKey = await resolveApiKeyForProvider(providerId, modelId);

  const requestPayload = buildServerRequest(config, apiKey);

  return await pluginApiClient.executeWithPolling<MarketObserverResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse;
      const status = resp.data?.status;
      const isComplete = status === 'completed' || status === 'failed' || status === 'rejected';
      const resultData = resp.data?.result as Record<string, unknown> | undefined;

      return {
        isComplete,
        result: {
          ...(resultData || {}),
          status: status as MarketObserverResult['status'],
          validation_status: resultData?.validation_status as MarketObserverResult['validation_status'],
          reason_code: resultData?.reason_code as string | undefined,
          strategy_code: resultData?.strategy_code as string | undefined,
          error: resultData?.error as MarketObserverResult['error'],
        } as MarketObserverResult,
        rawResponse: response,
      };
    },
  });
}

/**
 * Validate market observer configuration
 */
export function validateMarketObserverConfig(
  config: Partial<MarketObserverConfig>
): { valid: boolean; error?: string } {
  if (!config.rules || config.rules.length === 0) {
    return { valid: false, error: 'At least one rule is required' };
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

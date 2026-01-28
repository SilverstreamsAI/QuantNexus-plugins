/**
 * Market Observer Service - Plugin Layer
 *
 * Provides market observation and watchlist precondition functionality.
 * Part of Trader Mode in Strategy Builder.
 *
 * @see TICKET_077_1 - Page 35 (MarketObserverPage)
 * @see TICKET_202 - Builder Page Base Class Mapping
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
// Request Builder Types
// -----------------------------------------------------------------------------

interface ServerRule {
  rule_type: 'template_based' | 'custom_expression' | 'factor_based';
  indicator?: {
    slug: string;
    name: string;
    params?: Record<string, unknown>;
  };
  strategy?: {
    type: string;
    logic: {
      operator: string;
      threshold_value: string | number;
    };
  };
  expression?: string;
  factor?: {
    name: string;
    category: string;
    params?: Record<string, unknown>;
  };
}

interface ServerRequest {
  user_id: number;
  strategy_name: string;
  locale: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
  observer_config: {
    llm_config: {
      prompt: string;
      provider: string;
      model: string;
      api_key?: string;
    };
    rules: ServerRule[];
  };
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

function transformRules(rules: MarketObserverRule[]): ServerRule[] {
  return rules.map((rule): ServerRule => {
    if (rule.rule_type === 'custom_expression') {
      return {
        rule_type: 'custom_expression',
        expression: rule.expression || '',
      };
    }

    if (rule.rule_type === 'factor_based') {
      return {
        rule_type: 'factor_based',
        factor: rule.factor,
      };
    }

    return {
      rule_type: 'template_based',
      indicator: rule.indicator,
      strategy: {
        type: rule.strategy?.logic?.type || 'threshold_level',
        logic: {
          operator: rule.strategy?.logic?.operator || '>',
          threshold_value: rule.strategy?.logic?.threshold_value ?? 0,
        },
      },
    };
  });
}

function buildPrompt(config: MarketObserverConfig): string {
  const ruleDescriptions = config.rules.map((rule) => {
    if (rule.rule_type === 'custom_expression') {
      return rule.expression || '';
    }

    if (rule.rule_type === 'factor_based') {
      const factor = rule.factor;
      const paramsStr = factor?.params
        ? Object.entries(factor.params).map(([k, v]) => `${k}=${v}`).join(', ')
        : '';
      return paramsStr ? `Factor:${factor?.name}(${paramsStr})` : `Factor:${factor?.name}`;
    }

    const indicator = rule.indicator;
    const logic = rule.strategy?.logic;
    const paramsStr = indicator?.params
      ? Object.entries(indicator.params).map(([k, v]) => `${k}=${v}`).join(', ')
      : '';
    const indicatorPart = paramsStr ? `${indicator?.name}(${paramsStr})` : indicator?.name;
    const logicStr = logic?.operator && logic?.threshold_value !== undefined
      ? `${logic.operator} ${logic.threshold_value}`
      : '';

    return logicStr ? `${indicatorPart} ${logicStr}` : indicatorPart;
  });

  const rulesStr = ruleDescriptions.filter(Boolean).join(' AND ');

  return `Generate a market observer precondition strategy using: ${rulesStr}`;
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

function buildServerRequest(config: MarketObserverConfig, apiKey?: string): ServerRequest {
  const serverRules = transformRules(config.rules);
  const prompt = buildPrompt(config);

  return {
    user_id: 1,
    strategy_name: config.strategy_name || 'Untitled Observer',
    locale: 'en',
    storage_mode: config.storage_mode || 'local',
    observer_config: {
      llm_config: {
        prompt,
        provider: config.llm_provider || 'NONA',
        model: config.llm_model || 'nona-default',
        api_key: apiKey,
      },
      rules: serverRules,
    },
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

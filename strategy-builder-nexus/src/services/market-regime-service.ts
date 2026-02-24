/**
 * Market Regime Service - Plugin Layer (TICKET_091, TICKET_095)
 *
 * Provides market regime analysis functionality directly from plugin.
 * Uses plugin's own API client (CSP relaxed per TICKET_091).
 *
 * @see TICKET_091 - Desktop CSP Relaxation
 * @see TICKET_095 - Inline Code Display After Generate
 */

import { pluginApiClient, ApiResponse } from './api-client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/start_market_regime_analysis',
  STATUS: '/api/check_market_regime_status',
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MarketRegimeConfig {
  regime: string;
  rules: MarketRegimeRule[];
  strategy_name?: string;
  bespoke_notes?: string;
  llm_provider?: string;
  llm_model?: string;
  /** TICKET_200: Storage mode preference - tells server whether to store generated data */
  storage_mode?: 'local' | 'remote' | 'hybrid';
  /** TICKET_260: Auto-reverse mode - range condition auto-generated as inverse of trend */
  auto_reverse?: boolean;
}

export interface MarketRegimeRule {
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
    params?: Record<string, unknown>;
  };
  expression?: string;
  factor?: {
    name: string;
    category: string;
    params?: Record<string, unknown>;
  };
  /** TICKET_260: Indicator category for manual mode */
  category?: 'trend' | 'range';
}

export interface MarketRegimeResult {
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
 * @see CODE_GENERATOR_PROMPT_BEST_PRACTICES.md
 */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Security violations
  SECURITY_VIOLATION: 'Security violation detected. Please check your input for potentially harmful content (e.g., code injection attempts, SQL injection, or prompt injection).',

  // Validation errors
  INVALID: 'Invalid input detected. Please check your configuration for syntax errors, unknown indicators, or unsupported operators.',
  SYNTAX_ERROR: 'Syntax error in your expression. Please check bracket matching and operator usage.',
  UNKNOWN_INDICATOR: 'Unknown indicator specified. Please use supported indicators from the indicator list.',
  UNSUPPORTED_OPERATOR: 'Unsupported operator in expression. Please use valid operators.',

  // Network/System errors
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
  TASK_FAILED: 'Task processing failed. Please try again later.',

  // LLM errors
  LLM_ERROR: 'AI model encountered an error. Please try again or simplify your request.',
  GENERATION_FAILED: 'Code generation failed. Please review your configuration and try again.',
};

/**
 * Get user-friendly error message from error response
 */
export function getErrorMessage(result: MarketRegimeResult): string {
  // Check reason_code first (from rejected status)
  if (result.reason_code && ERROR_CODE_MESSAGES[result.reason_code]) {
    return ERROR_CODE_MESSAGES[result.reason_code];
  }

  // Check error.error_code
  if (result.error?.error_code && ERROR_CODE_MESSAGES[result.error.error_code]) {
    return ERROR_CODE_MESSAGES[result.error.error_code];
  }

  // Check error.code (legacy format)
  if (result.error?.code && ERROR_CODE_MESSAGES[result.error.code]) {
    return ERROR_CODE_MESSAGES[result.error.code];
  }

  // Return error_message or message if available
  if (result.error?.error_message) {
    return result.error.error_message;
  }

  if (result.error?.message) {
    return result.error.message;
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}

// -----------------------------------------------------------------------------
// Request Builder Types
// -----------------------------------------------------------------------------

/**
 * TICKET_260: Protocol-compliant indicator format
 * @see TICKET_260_REGIME_DETECTOR_ENTRY_RESPONSIBILITY_CLARIFICATION.md
 */
interface ServerIndicator {
  type: string;
  name: string;
  params?: Record<string, unknown>;
  /** Required when auto_reverse=false */
  category?: 'trend' | 'range';
}

interface ServerRequest {
  strategy_name: string;
  locale: string;
  output_format?: 'v1' | 'v3'; // TICKET_223: V3 framework import format
  /** TICKET_200: Storage mode preference - server should not store data if 'local' */
  storage_mode?: 'local' | 'remote' | 'hybrid';
  /** TICKET_260: Auto-reverse mode */
  auto_reverse?: boolean;
  analysis_config: {
    regime: Array<{
      case_type: string;
      enabled?: boolean;
      params: {
        /** TICKET_260: Protocol-compliant indicator array */
        indicators: ServerIndicator[];
        factors?: unknown[];
      };
    }>;
    llm_config: {
      prompt: string;
      provider: string;
      model?: string;
      api_key?: string; // TICKET_193: BYOK API key
    };
    /** TICKET_260: Auto-reverse mode (also at top level for compatibility) */
    auto_reverse?: boolean;
  };
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

function mapRegimeToCaseType(regime: string): string {
  const regimeMap: Record<string, string> = {
    trend: 'TREND_DETECTION',
    range: 'RANGE_DETECTION',
    consolidation: 'CONSOLIDATION_DETECTION',
    oscillation: 'OSCILLATION_DETECTION',
  };

  if (regime.startsWith('bespoke_')) {
    return regime;
  }

  return regimeMap[regime] || regime.toUpperCase();
}

/**
 * TICKET_260: Transform rules to protocol-compliant indicator format
 * @see TICKET_260_REGIME_DETECTOR_ENTRY_RESPONSIBILITY_CLARIFICATION.md
 */
function transformToServerIndicators(rules: MarketRegimeRule[], autoReverse: boolean): ServerIndicator[] {
  return rules
    .filter((rule) => rule.rule_type === 'template_based' && rule.indicator)
    .map((rule): ServerIndicator => {
      const indicator = rule.indicator!;
      const logic = rule.strategy?.logic;

      // Build params including threshold if specified
      const params: Record<string, unknown> = { ...indicator.params };
      if (logic?.threshold_value !== undefined) {
        params.threshold = logic.threshold_value;
      }
      if (logic?.operator) {
        params.operator = logic.operator;
      }

      return {
        type: indicator.slug,
        name: indicator.name || indicator.slug,
        params: Object.keys(params).length > 0 ? params : undefined,
        // TICKET_260: Include category (default to 'trend' for auto-reverse mode)
        category: rule.category || (autoReverse ? undefined : 'trend'),
      };
    });
}

function buildPrompt(config: MarketRegimeConfig): string {
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
  const regimeLabel = config.regime.replace(/_/g, ' ');

  if (config.bespoke_notes) {
    return `${config.bespoke_notes}\n\nRules: ${rulesStr}`;
  }

  return `Generate a ${regimeLabel} strategy using: ${rulesStr}`;
}

/**
 * TICKET_193: Build server request with optional API key
 * TICKET_200: Include storage_mode preference
 * TICKET_260: Include auto_reverse parameter and protocol-compliant format
 */
function buildServerRequest(config: MarketRegimeConfig, apiKey?: string): ServerRequest {
  // TICKET_260: Default to true if not specified
  const autoReverse = config.auto_reverse !== false;
  const serverIndicators = transformToServerIndicators(config.rules, autoReverse);
  const prompt = buildPrompt(config);
  const caseType = mapRegimeToCaseType(config.regime);

  // DEBUG: Log transformation for troubleshooting
  console.info('[MarketRegimeService] Input rules:', config.rules.length);
  console.info('[MarketRegimeService] Transformed indicators:', serverIndicators.length);
  console.info('[MarketRegimeService] Indicators:', JSON.stringify(serverIndicators));

  return {
    strategy_name: config.strategy_name || 'Untitled Strategy',
    locale: 'en',
    output_format: 'v3', // TICKET_223: V3 framework import format
    // TICKET_200: Include storage mode preference (defaults to 'local' if not specified)
    storage_mode: config.storage_mode || 'local',
    // TICKET_260: Auto-reverse mode (top level)
    auto_reverse: autoReverse,
    analysis_config: {
      // TICKET_260: Protocol-compliant regime config
      regime: [{
        case_type: caseType,
        params: {
          indicators: serverIndicators,
          factors: [],
        },
      }],
      llm_config: {
        prompt,
        provider: config.llm_provider || 'NONA',
        model: config.llm_model || 'nona-default',
        api_key: apiKey, // TICKET_193: BYOK API key (undefined if not provided)
      },
      // TICKET_260: Auto-reverse mode (also in analysis_config for compatibility)
      auto_reverse: autoReverse,
    },
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * TICKET_193/196: Resolve API key for the selected provider and model
 *
 * Rules per TICKET_196:
 * - nona-nexus model: No API key needed (platform handles it)
 * - Other models (gpt-5-mini, etc.): Need API key (BYOK or system)
 */
async function resolveApiKeyForProvider(providerId: string, modelId: string): Promise<string | undefined> {
  // nona-nexus is the only model that doesn't need API key
  if (modelId === 'nona-nexus') {
    console.debug('[MarketRegimeService] nona-nexus model, no API key needed');
    return undefined;
  }

  // For all other models, try to resolve BYOK key
  // Even for NONA provider with non-nona-nexus models (e.g., gpt-5-mini)
  try {
    // Determine which provider's key to use
    // If NONA with external model, we need to find the matching provider
    let keyProviderId = providerId;
    if (providerId === 'NONA') {
      // Map model to provider for BYOK key lookup
      keyProviderId = mapModelToProvider(modelId);
    }

    const result = await window.electronAPI.entitlement.resolveLLMApiKey(keyProviderId);
    if (result.success && result.data?.key) {
      console.debug(`[MarketRegimeService] Resolved API key for ${keyProviderId}, source: ${result.data.source}`);
      return result.data.key;
    }
    console.debug(`[MarketRegimeService] No BYOK key found for ${keyProviderId}, backend will use system key`);
    return undefined;
  } catch (error) {
    console.error(`[MarketRegimeService] Failed to resolve API key:`, error);
    return undefined;
  }
}

/**
 * TICKET_196: Map model ID to provider ID for BYOK key lookup
 */
function mapModelToProvider(modelId: string): string {
  if (modelId.startsWith('gpt-') || modelId.startsWith('o3-')) return 'OPENAI';
  if (modelId.startsWith('claude-')) return 'CLAUDE';
  if (modelId.startsWith('gemini-')) return 'GEMINI';
  if (modelId.startsWith('deepseek-')) return 'DEEPSEEK';
  if (modelId.startsWith('grok-')) return 'GROK';
  if (modelId.startsWith('qwen')) return 'QWEN';
  return 'NONA'; // Fallback
}

/**
 * Execute market regime analysis
 */
export async function executeMarketRegimeAnalysis(
  config: MarketRegimeConfig
): Promise<MarketRegimeResult> {
  // TICKET_193/196: Resolve API key based on provider and model
  const providerId = config.llm_provider || 'NONA';
  const modelId = config.llm_model || 'nona-nexus';
  const apiKey = await resolveApiKeyForProvider(providerId, modelId);

  const requestPayload = buildServerRequest(config, apiKey);

  return await pluginApiClient.executeWithPolling<MarketRegimeResult>({
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
          // Spread first, then override to prevent inner status from overwriting
          ...(resultData || {}),
          status: status as MarketRegimeResult['status'],
          validation_status: resultData?.validation_status as MarketRegimeResult['validation_status'],
          reason_code: resultData?.reason_code as string | undefined,
          strategy_code: resultData?.strategy_code as string | undefined,
          error: resultData?.error as MarketRegimeResult['error'],
        } as MarketRegimeResult,
        rawResponse: response,
      };
    },
  });
}

/**
 * Validate market regime configuration
 */
export function validateMarketRegimeConfig(
  config: Partial<MarketRegimeConfig>
): { valid: boolean; error?: string } {
  if (!config.regime) {
    return { valid: false, error: 'Regime type is required' };
  }

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

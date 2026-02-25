/**
 * Regime Indicator Entry Service - Plugin Layer
 *
 * TICKET_203: Renamed from kronos-indicator-entry-service.ts
 * TICKET_201 Phase 4: Corrected API for Entry Signal generation
 *
 * Uses: /api/start_regime_indicator_entry (NOT /api/start_kronos_indicator_entry)
 *
 * This service generates TrendStrategyBase/RangeStrategyBase/StandaloneStrategyBase strategies that:
 * - check_open_conditions() -> (long_signal, short_signal)
 * - check_close_conditions() -> bool
 * - Execute actual trades (unlike MarketStateBase which only detects states)
 *
 * @see TICKET_201 - Workflow Strategy Code Generation Fix
 * @see TICKET_202 - Builder Page Base Class Mapping
 * @see TICKET_203 - Regime Indicator Entry Service Rename
 */

import { pluginApiClient, createStandardPollHandler } from './api-client';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  // TICKET_201: Correct API endpoint for entry signal generation
  START: '/api/start_regime_indicator_entry',
  STATUS: '/api/check_regime_indicator_entry_status',
};

// -----------------------------------------------------------------------------
// Public Types (used by EntrySignalPage)
// -----------------------------------------------------------------------------

export interface RegimeIndicatorEntryConfig {
  strategy_name: string;
  rules: IndicatorEntryRule[];
  entry_signal_base?: 'standalone' | 'trend' | 'range';
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
  /** TICKET_260: Auto-reverse mode - short condition auto-generated as inverse of long */
  auto_reverse?: boolean;
}

export interface IndicatorEntryRule {
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

export interface RegimeIndicatorEntryResult {
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
export const ENTRY_ERROR_CODE_MESSAGES: Record<string, string> = {
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
export function getEntryErrorMessage(result: RegimeIndicatorEntryResult): string {
  if (result.reason_code && ENTRY_ERROR_CODE_MESSAGES[result.reason_code]) {
    return ENTRY_ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && ENTRY_ERROR_CODE_MESSAGES[result.error.error_code]) {
    return ENTRY_ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && ENTRY_ERROR_CODE_MESSAGES[result.error.code]) {
    return ENTRY_ERROR_CODE_MESSAGES[result.error.code];
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
// Server Request Types (matches /api/start_regime_indicator_entry format)
// -----------------------------------------------------------------------------

/**
 * Server indicator rule format
 * @see nona_server/src/observer/entry_signal_google.py
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
 * Server request format for /api/start_regime_indicator_entry
 * @see nona_server/src/main_service/business/market_analysis_business.py
 */
interface ServerRequest {
  task_id?: string;
  locale?: string;
  output_format?: 'v1' | 'v3'; // TICKET_223: V3 framework import format
  storage_mode: 'local' | 'remote' | 'hybrid';
  /** TICKET_260: Auto-reverse mode */
  auto_reverse?: boolean;
  regime_indicator_entry_config: {
    longEntryIndicators: ServerIndicatorRule[];
    shortEntryIndicators: ServerIndicatorRule[];
    strategy_name: string;
    entry_signal_base: string;
    llm_provider?: string;
    llm_model?: string;
    /** TICKET_260: Auto-reverse mode (also in config for compatibility) */
    auto_reverse?: boolean;
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
function transformRule(rule: IndicatorEntryRule): ServerIndicatorRule | null {
  // Only template_based rules are supported for now
  if (rule.rule_type !== 'template_based') {
    console.warn('[RegimeIndicatorEntry] Skipping non-template rule:', rule.rule_type);
    return null;
  }

  if (!rule.indicator?.slug) {
    console.warn('[RegimeIndicatorEntry] Skipping rule without indicator slug');
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
 * TICKET_260: Include auto_reverse parameter
 */
function buildServerRequest(config: RegimeIndicatorEntryConfig): ServerRequest {
  // Transform all rules to server format
  // For now, all rules go to longEntryIndicators
  // TODO: Support separate long/short indicators from UI
  const serverRules: ServerIndicatorRule[] = [];

  for (const rule of config.rules) {
    const transformed = transformRule(rule);
    if (transformed) {
      serverRules.push(transformed);
    }
  }

  // Generate task_id
  const taskId = `regime_indicator_entry_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // TICKET_260: Default to true if not specified
  const autoReverse = config.auto_reverse !== false;

  return {
    task_id: taskId,
    locale: 'en',
    output_format: 'v3', // TICKET_223: V3 framework import format
    storage_mode: config.storage_mode || 'local',
    // TICKET_260: Auto-reverse mode (top level)
    auto_reverse: autoReverse,
    regime_indicator_entry_config: {
      longEntryIndicators: serverRules,
      shortEntryIndicators: [], // TODO: Support from UI
      strategy_name: config.strategy_name || 'Untitled Entry Strategy',
      entry_signal_base: config.entry_signal_base || 'standalone',
      llm_provider: config.llm_provider || 'NONA',
      llm_model: config.llm_model || 'nona-nexus',
      // TICKET_260: Auto-reverse mode (also in config for compatibility)
      auto_reverse: autoReverse,
    },
    llm_provider: config.llm_provider || 'NONA',
    llm_model: config.llm_model || 'nona-nexus',
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute Regime Indicator Entry generation
 *
 * TICKET_201: Calls /api/start_regime_indicator_entry which generates
 * TrendStrategyBase/RangeStrategyBase/StandaloneStrategyBase strategies with actual trading logic.
 */
export async function executeRegimeIndicatorEntry(
  config: RegimeIndicatorEntryConfig
): Promise<RegimeIndicatorEntryResult> {
  const requestPayload = buildServerRequest(config);

  console.debug('[RegimeIndicatorEntry] Calling API:', API_ENDPOINTS.START);
  console.debug('[RegimeIndicatorEntry] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<RegimeIndicatorEntryResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    // TICKET_417: Centralized poll handler
    // Layer 2 standard: strategy_code and class_name at result top level
    handlePollResponse: createStandardPollHandler<RegimeIndicatorEntryResult>(
      'RegimeIndicatorEntry',
      (status, result) => ({
        status: status as RegimeIndicatorEntryResult['status'],
        validation_status: result?.validation_status as RegimeIndicatorEntryResult['validation_status'],
        reason_code: result?.reason_code as string | undefined,
        strategy_code: result?.strategy_code as string | undefined,
        class_name: result?.class_name as string | undefined,
        error: result?.error as RegimeIndicatorEntryResult['error'],
      }),
    ),
  });
}

/**
 * Validate Regime Indicator Entry configuration
 */
export function validateRegimeIndicatorEntryConfig(
  config: Partial<RegimeIndicatorEntryConfig>
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

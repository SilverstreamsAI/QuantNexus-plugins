/**
 * Risk Override Exit Service - Plugin Layer
 *
 * TICKET_274: Indicator Exit Generator (Risk Manager)
 *
 * Generates Python risk override rules (Layer 1) that operate above
 * the Alpha Factory combinator. These rules activate ONLY when the
 * combinator fails or market conditions change drastically.
 *
 * Uses: /api/start_exit_strategy, /api/check_exit_strategy_status
 *
 * @see TICKET_274 - Indicator Exit Generator Page (Risk Manager)
 * @see TICKET_247 - Alpha Factory Architecture (Simons-style)
 */

import { pluginApiClient, ApiResponse } from './api-client';
import { getCurrentUserId } from '../utils/auth-utils';

// =============================================================================
// Constants
// =============================================================================

const API_ENDPOINTS = {
  START: '/api/start_exit_strategy',
  STATUS: '/api/check_exit_strategy_status',
};

/** Max rules per configuration */
export const MAX_RISK_RULES = 10;

/** Rule type definitions with UI metadata */
export const RISK_RULE_TYPES = [
  { value: 'circuit_breaker', label: 'Circuit Breaker', icon: 'Zap', color: 'red' },
  { value: 'time_limit', label: 'Time Limit', icon: 'Clock', color: 'teal' },
  { value: 'regime_detection', label: 'Regime Detection', icon: 'Activity', color: 'warning' },
  { value: 'drawdown_limit', label: 'Drawdown Limit', icon: 'TrendingDown', color: 'red' },
  { value: 'indicator_guard', label: 'Indicator Guard', icon: 'Shield', color: 'primary' },
] as const;

/** Circuit breaker scopes */
export const CB_SCOPES = [
  { value: 'per_position', label: 'Per Position' },
  { value: 'per_signal_group', label: 'Per Signal Group' },
  { value: 'portfolio', label: 'Portfolio' },
] as const;

/** Rule actions */
export const RULE_ACTIONS = [
  { value: 'close_all', label: 'Close All' },
  { value: 'close_position', label: 'Close Position' },
  { value: 'reduce_all', label: 'Reduce All Positions' },
  { value: 'reduce_to', label: 'Reduce To %' },
  { value: 'halt_trading', label: 'Halt Trading' },
  { value: 'halt_new_entry', label: 'Halt New Entry' },
] as const;

/** Time limit units */
export const TIME_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'bars', label: 'Bars' },
] as const;

/** Decay schedules */
export const DECAY_SCHEDULES = [
  { value: 'none', label: 'None (hard cutoff)' },
  { value: 'linear', label: 'Linear Decay' },
  { value: 'exponential', label: 'Exponential Decay' },
] as const;

/** Recovery modes */
export const RECOVERY_MODES = [
  { value: 'auto', label: 'Auto (when condition clears)' },
  { value: 'manual', label: 'Manual Resume' },
] as const;

/** Indicator conditions */
export const INDICATOR_CONDITIONS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'crosses_above', label: 'Crosses Above' },
  { value: 'crosses_below', label: 'Crosses Below' },
] as const;

/** Direction options */
export const DIRECTION_OPTIONS = [
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
  { value: 'both', label: 'Both' },
] as const;

/** Default values per rule type */
export const RULE_DEFAULTS = {
  circuit_breaker: { triggerPnlPercent: -5, cooldownBars: 10 },
  time_limit: { maxHolding: 48, unit: 'hours' as const },
  regime_detection: { threshold: 2.5, reducePercent: 50 },
  drawdown_limit: { maxDrawdownPercent: -10 },
  indicator_guard: { threshold: 95 },
  hard_safety: { maxLossPercent: -20 },
} as const;

// =============================================================================
// Public Types
// =============================================================================

interface RiskOverrideRuleBase {
  id: string;
  enabled: boolean;
  priority: number;
}

export interface CircuitBreakerRule extends RiskOverrideRuleBase {
  type: 'circuit_breaker';
  triggerPnlPercent: number;
  scope: 'per_position' | 'per_signal_group' | 'portfolio';
  action: 'close_all' | 'reduce_to';
  reduceToPercent?: number;
  cooldownBars: number;
}

export interface TimeLimitRule extends RiskOverrideRuleBase {
  type: 'time_limit';
  maxHolding: number;
  unit: 'hours' | 'bars';
  decay: 'none' | 'linear' | 'exponential';
  action: 'close_all' | 'reduce_to';
  reduceToPercent?: number;
}

export interface RegimeDetectionRule extends RiskOverrideRuleBase {
  type: 'regime_detection';
  indicator: {
    name: string;
    parameters: Record<string, number>;
  };
  condition: '>' | '<' | 'crosses_above' | 'crosses_below';
  threshold: number;
  action: 'reduce_all' | 'close_all' | 'halt_new_entry';
  reducePercent?: number;
  recovery: 'auto' | 'manual';
}

export interface DrawdownLimitRule extends RiskOverrideRuleBase {
  type: 'drawdown_limit';
  maxDrawdownPercent: number;
  action: 'reduce_all' | 'close_all' | 'halt_trading';
  reducePercent?: number;
  recoveryBars?: number;
  recovery: 'auto' | 'manual';
}

export interface IndicatorGuardRule extends RiskOverrideRuleBase {
  type: 'indicator_guard';
  indicator: {
    name: string;
    parameters: Record<string, number>;
  };
  condition: '>' | '<' | '>=' | '<=';
  threshold: number;
  appliesTo: 'long' | 'short' | 'both';
  action: 'close_position' | 'reduce_to';
  reduceToPercent?: number;
}

export type RiskOverrideRule =
  | CircuitBreakerRule
  | TimeLimitRule
  | RegimeDetectionRule
  | DrawdownLimitRule
  | IndicatorGuardRule;

export type RiskRuleType = RiskOverrideRule['type'];

/**
 * Page state interface
 */
export interface IndicatorExitState {
  direction: 'long' | 'short' | 'both';
  rules: RiskOverrideRule[];
  hardSafety: {
    maxLossPercent: number;
  };
  storageMode: 'local' | 'remote' | 'hybrid';
  llmProvider: string;
  llmModel: string;
}

/**
 * API config sent to useGenerateWorkflow
 */
export interface RiskOverrideExitConfig {
  strategy_name: string;
  direction: 'long' | 'short' | 'both';
  rules: RiskOverrideRule[];
  hard_safety: {
    max_loss_percent: number;
  };
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
}

/**
 * API result
 */
export interface RiskOverrideExitResult {
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

// =============================================================================
// Error Handling
// =============================================================================

export const EXIT_ERROR_CODE_MESSAGES: Record<string, string> = {
  SECURITY_VIOLATION: 'Security violation detected. Please check your input.',
  INVALID: 'Invalid input detected. Please check your configuration.',
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  TASK_FAILED: 'Task processing failed. Please try again later.',
  LLM_ERROR: 'AI model encountered an error. Please try again.',
  GENERATION_FAILED: 'Code generation failed. Please review your configuration.',
  NO_RULES_ENABLED: 'At least one risk override rule must be enabled.',
  INVALID_RULE_CONFIG: 'One or more rules have invalid configuration.',
};

/**
 * Get user-friendly error message from error response
 */
export function getExitErrorMessage(result: RiskOverrideExitResult): string {
  if (result.reason_code && EXIT_ERROR_CODE_MESSAGES[result.reason_code]) {
    return EXIT_ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && EXIT_ERROR_CODE_MESSAGES[result.error.error_code]) {
    return EXIT_ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && EXIT_ERROR_CODE_MESSAGES[result.error.code]) {
    return EXIT_ERROR_CODE_MESSAGES[result.error.code];
  }

  if (result.error?.error_message) {
    return result.error.error_message;
  }

  if (result.error?.message) {
    return result.error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// =============================================================================
// Server Request Types
// =============================================================================

/**
 * Server rule format (snake_case for API)
 */
interface ServerRule {
  type: string;
  priority: number;
  [key: string]: unknown;
}

/**
 * Server request format for /api/start_exit_strategy
 */
interface ServerRequest {
  user_id: number;
  task_id: string;
  locale: string;
  output_format: 'v3';
  storage_mode: string;
  exit_config: {
    strategy_name: string;
    exit_model: 'risk_override';
    direction: string;
    rules: ServerRule[];
    hard_safety: {
      max_loss_percent: number;
    };
    llm_provider?: string;
    llm_model?: string;
  };
  llm_provider?: string;
  llm_model?: string;
}

// =============================================================================
// Request Builder
// =============================================================================

/**
 * Transform UI rule to server format (camelCase -> snake_case)
 */
function transformRule(rule: RiskOverrideRule): ServerRule {
  const base = {
    type: rule.type,
    priority: rule.priority,
  };

  switch (rule.type) {
    case 'circuit_breaker':
      return {
        ...base,
        trigger_pnl_percent: rule.triggerPnlPercent,
        scope: rule.scope,
        action: rule.action,
        reduce_to_percent: rule.reduceToPercent,
        cooldown_bars: rule.cooldownBars,
      };

    case 'time_limit':
      return {
        ...base,
        max_holding: rule.maxHolding,
        unit: rule.unit,
        decay: rule.decay,
        action: rule.action,
        reduce_to_percent: rule.reduceToPercent,
      };

    case 'regime_detection':
      return {
        ...base,
        indicator: rule.indicator,
        condition: rule.condition,
        threshold: rule.threshold,
        action: rule.action,
        reduce_percent: rule.reducePercent,
        recovery: rule.recovery,
      };

    case 'drawdown_limit':
      return {
        ...base,
        max_drawdown_percent: rule.maxDrawdownPercent,
        action: rule.action,
        reduce_percent: rule.reducePercent,
        recovery_bars: rule.recoveryBars,
        recovery: rule.recovery,
      };

    case 'indicator_guard':
      return {
        ...base,
        indicator: rule.indicator,
        condition: rule.condition,
        threshold: rule.threshold,
        applies_to: rule.appliesTo,
        action: rule.action,
        reduce_to_percent: rule.reduceToPercent,
      };
  }
}

/**
 * Build server request from client config
 */
function buildServerRequest(config: RiskOverrideExitConfig, userId: number): ServerRequest {
  const enabledRules = config.rules.filter(r => r.enabled);
  const serverRules = enabledRules.map(transformRule);

  const taskId = `exit_strategy_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    user_id: userId,
    task_id: taskId,
    locale: 'en',
    output_format: 'v3',
    storage_mode: config.storage_mode || 'local',
    exit_config: {
      strategy_name: config.strategy_name || 'Untitled Exit Strategy',
      exit_model: 'risk_override',
      direction: config.direction,
      rules: serverRules,
      hard_safety: config.hard_safety,
      llm_provider: config.llm_provider || 'NONA',
      llm_model: config.llm_model || 'nona-nexus',
    },
    llm_provider: config.llm_provider || 'NONA',
    llm_model: config.llm_model || 'nona-nexus',
  };
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Execute Risk Override Exit generation
 *
 * TICKET_274: Calls /api/start_exit_strategy which generates
 * ExitSignalBase strategies with risk override rules.
 */
export async function executeRiskOverrideExit(
  config: RiskOverrideExitConfig
): Promise<RiskOverrideExitResult> {
  const userId = await getCurrentUserId();
  const requestPayload = buildServerRequest(config, userId);

  console.debug('[RiskOverrideExit] Calling API:', API_ENDPOINTS.START);
  console.debug('[RiskOverrideExit] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<RiskOverrideExitResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse;
      const status = resp.data?.status;
      const isComplete = status === 'completed' || status === 'failed' || status === 'rejected';

      console.debug('[RiskOverrideExit] Poll response:', JSON.stringify(resp, null, 2).substring(0, 2000));

      const entryResult = resp.data?.result as Record<string, unknown> | undefined;
      const exitResult = entryResult?.exit_strategy_result as Record<string, unknown> | undefined;

      let strategyCode = exitResult?.strategy_code as string | undefined;
      if (!strategyCode) {
        strategyCode = entryResult?.strategy_code as string | undefined;
      }

      let className = exitResult?.class_name as string | undefined;
      if (!className) {
        className = entryResult?.class_name as string | undefined;
      }

      let validationStatus = exitResult?.validation_status as string | undefined;
      if (!validationStatus) {
        validationStatus = entryResult?.validation_status as string | undefined;
      }

      return {
        isComplete,
        result: {
          status: status as RiskOverrideExitResult['status'],
          validation_status: validationStatus as RiskOverrideExitResult['validation_status'],
          reason_code: (exitResult?.reason_code || entryResult?.reason_code) as string | undefined,
          strategy_code: strategyCode,
          class_name: className,
          error: (exitResult?.error || entryResult?.error) as RiskOverrideExitResult['error'],
        } as RiskOverrideExitResult,
        rawResponse: response,
      };
    },
  });
}

/**
 * Validate Risk Override Exit configuration
 */
export function validateRiskOverrideExitConfig(
  config: Partial<RiskOverrideExitConfig>
): { valid: boolean; error?: string } {
  if (!config.rules || config.rules.length === 0) {
    return { valid: false, error: 'At least one risk override rule is required' };
  }

  const enabledRules = config.rules.filter(r => r.enabled);
  if (enabledRules.length === 0) {
    return { valid: false, error: 'At least one risk override rule must be enabled' };
  }

  // Validate each enabled rule
  for (const rule of enabledRules) {
    switch (rule.type) {
      case 'circuit_breaker':
        if (rule.triggerPnlPercent >= 0) {
          return { valid: false, error: 'Circuit Breaker: trigger PnL must be negative' };
        }
        if (rule.cooldownBars < 0) {
          return { valid: false, error: 'Circuit Breaker: cooldown must be >= 0' };
        }
        break;

      case 'time_limit':
        if (rule.maxHolding <= 0) {
          return { valid: false, error: 'Time Limit: max holding must be > 0' };
        }
        break;

      case 'regime_detection':
        if (!rule.indicator?.name) {
          return { valid: false, error: 'Regime Detection: indicator is required' };
        }
        break;

      case 'drawdown_limit':
        if (rule.maxDrawdownPercent >= 0) {
          return { valid: false, error: 'Drawdown Limit: max drawdown must be negative' };
        }
        break;

      case 'indicator_guard':
        if (!rule.indicator?.name) {
          return { valid: false, error: 'Indicator Guard: indicator is required' };
        }
        break;
    }
  }

  // Validate hard safety
  if (!config.hard_safety || config.hard_safety.max_loss_percent >= 0) {
    return { valid: false, error: 'Hard Safety: max loss percent must be negative' };
  }

  return { valid: true };
}

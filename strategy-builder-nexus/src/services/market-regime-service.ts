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
}

export interface MarketRegimeResult {
  status: 'completed' | 'failed' | 'processing';
  strategy_code?: string;
  error?: { code?: string; message?: string };
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
  analysis_config: {
    regime: Array<{
      case_type: string;
      enabled: boolean;
      params: {
        indicators: ServerRule[];
        strategy_name: string;
        bespoke_notes?: string;
      };
    }>;
    llm_config: {
      prompt: string;
      provider: string;
      model: string;
    };
    rules: ServerRule[];
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

function transformRules(rules: MarketRegimeRule[]): ServerRule[] {
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

function buildServerRequest(config: MarketRegimeConfig): ServerRequest {
  const serverRules = transformRules(config.rules);
  const prompt = buildPrompt(config);
  const caseType = mapRegimeToCaseType(config.regime);

  return {
    user_id: 1,
    strategy_name: config.strategy_name || 'Untitled Strategy',
    locale: 'en',
    analysis_config: {
      regime: [{
        case_type: caseType,
        enabled: true,
        params: {
          indicators: serverRules,
          strategy_name: config.strategy_name || 'Untitled Strategy',
          bespoke_notes: config.bespoke_notes,
        },
      }],
      llm_config: {
        prompt,
        provider: config.llm_provider || 'NONA',
        model: config.llm_model || 'nona-default',
      },
      rules: serverRules,
    },
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute market regime analysis
 */
export async function executeMarketRegimeAnalysis(
  config: MarketRegimeConfig
): Promise<MarketRegimeResult> {
  const requestPayload = buildServerRequest(config);

  return await pluginApiClient.executeWithPolling<MarketRegimeResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse;
      const status = resp.data?.status;
      const isComplete = status === 'completed' || status === 'failed';
      const resultData = resp.data?.result as Record<string, unknown> | undefined;

      return {
        isComplete,
        result: {
          // Spread first, then override to prevent inner status from overwriting
          ...(resultData || {}),
          status: status as MarketRegimeResult['status'],
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

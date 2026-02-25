/**
 * AI Libero Service - Plugin Layer
 *
 * TICKET_077_26: Page 37 - Agent Mode AI Libero
 *
 * Uses: /api/agent_llm for LLM-powered agent strategy generation
 *
 * Key difference from Trader AI Entry (Page 36):
 * - Uses /api/agent_llm instead of /api/llm_trader
 * - Includes Prediction Configuration (AdvancedConfigPanel)
 * - signal_source: aiLibero
 *
 * @see TICKET_077_26 - AI Libero Page (page37)
 * @see TICKET_214 - Page 36 - Trader AI Entry (reference)
 */

import { pluginApiClient, createStandardPollHandler } from './api-client';
import type { RawIndicatorBlock } from '../components/ui/RawIndicatorSelector';
import type { IndicatorTemplate } from '../components/ui/SaveTemplateDialog';
import type { PredictionConfig } from '../components/ui/AdvancedConfigPanel';

// Re-export for convenience
export type { IndicatorTemplate, PredictionConfig };

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/agent_llm',
  STATUS: '/api/check_agent_llm_status',
};

const TEMPLATE_STORAGE_KEY = 'ai-libero-templates';
const PLUGIN_ID = 'com.quantnexus.strategy-builder-nexus';

// -----------------------------------------------------------------------------
// Public Types
// -----------------------------------------------------------------------------

/**
 * Trader preset mode (shared with TraderAIEntry)
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
 * AI Libero configuration (client format)
 */
export interface AILiberoConfig {
  strategy_name: string;
  preset_mode: TraderPresetMode;
  bespoke_config?: BespokeConfig;
  prediction_config: PredictionConfig;
  prompt: string;
  indicators: RawIndicatorBlock[];
  llm_provider?: string;
  llm_model?: string;
  storage_mode?: 'local' | 'remote' | 'hybrid';
}

/**
 * AI Libero result
 */
export interface AILiberoResult {
  status: 'completed' | 'failed' | 'processing' | 'rejected';
  validation_status?: 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';
  reason_code?: string;
  strategy_code?: string;
  strategy_id?: string;
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
export const AI_LIBERO_ERROR_CODE_MESSAGES: Record<string, string> = {
  SECURITY_VIOLATION: 'Security violation detected. Please check your input.',
  INVALID: 'Invalid input detected. Please check your configuration.',
  INVALID_PROMPT: 'Invalid prompt. Please provide a valid trading strategy description.',
  PROMPT_TOO_SHORT: 'Prompt is too short. Please provide more details.',
  PROMPT_TOO_LONG: 'Prompt is too long. Please shorten your description.',
  INVALID_PRESET: 'Invalid preset mode selected.',
  INVALID_BESPOKE_CONFIG: 'Invalid bespoke configuration values.',
  INVALID_PREDICTION_CONFIG: 'Invalid prediction configuration values.',
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
export function getAILiberoErrorMessage(result: AILiberoResult): string {
  if (result.reason_code && AI_LIBERO_ERROR_CODE_MESSAGES[result.reason_code]) {
    return AI_LIBERO_ERROR_CODE_MESSAGES[result.reason_code];
  }

  if (result.error?.error_code && AI_LIBERO_ERROR_CODE_MESSAGES[result.error.error_code]) {
    return AI_LIBERO_ERROR_CODE_MESSAGES[result.error.error_code];
  }

  if (result.error?.code && AI_LIBERO_ERROR_CODE_MESSAGES[result.error.code]) {
    return AI_LIBERO_ERROR_CODE_MESSAGES[result.error.code];
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
// Server Request Types (matches /api/agent_llm format)
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
 * Trader mode configuration for server
 */
interface ServerTraderMode {
  mode: TraderPresetMode;
  version: string;
  config_source: string;
  constraints: TraderModeConstraints;
}

/**
 * Trader mode constraints
 */
interface TraderModeConstraints {
  'Core Goal': string;
  'Risk Tolerance': string;
  'Position Limits': string;
  'Trading Frequency': string;
  'Leverage': string;
  'Risk Metrics': string;
  'Decision Inputs': string;
  'Model Requirements': string;
}

/**
 * Server request format for /api/agent_llm
 */
interface ServerRequest {
  task_id?: string;
  locale?: string;
  output_format?: 'v1' | 'v3';
  llm_provider: string;
  llm_model: string;
  storage_mode: 'local' | 'remote' | 'hybrid';
  operation_type: 'generate_strategy';
  operation_data: {
    strategy_id?: number;
    strategy_name: string;
    trader_mode: ServerTraderMode;
    prediction: {
      batchSize: number;
      warmupPeriod: number;
      lookbackBars: number;
      analysisInterval: number;
    };
    llm: {
      provider: string;
      model: string;
      timeout: number;
      retries: number;
      prompt: string;
    };
    rawIndicators: ServerRawIndicator[];
  };
}

// -----------------------------------------------------------------------------
// Preset Mode Constraints
// -----------------------------------------------------------------------------

const PRESET_MODE_CONSTRAINTS: Record<TraderPresetMode, TraderModeConstraints> = {
  baseline: {
    'Core Goal': 'Maximize absolute returns without extra constraints',
    'Risk Tolerance': 'Medium to High (Model decided)',
    'Position Limits': 'None or very loose',
    'Trading Frequency': 'Unlimited (High frequency or long term)',
    'Leverage': '1x (No leverage) or very low',
    'Risk Metrics': 'Sharpe Ratio, Max Drawdown',
    'Decision Inputs': 'Market data, News, Fundamentals',
    'Model Requirements': 'Comprehensive capabilities',
  },
  monk: {
    'Core Goal': 'Stability and risk-adjusted returns under strict limits',
    'Risk Tolerance': 'Very Low (Mandatory rules)',
    'Position Limits': 'Strict (e.g., <2% per trade, sector limits)',
    'Trading Frequency': 'Very Low (Daily/Weekly caps, forced "asceticism")',
    'Leverage': 'Forbidden',
    'Risk Metrics': 'Sortino Ratio, Max Drawdown, Volatility',
    'Decision Inputs': 'Filter short-term noise, focus on long-term trends',
    'Model Requirements': 'Discipline, Patience, Long-term value',
  },
  warrior: {
    'Core Goal': 'Maximize returns through aggressive market engagement',
    'Risk Tolerance': 'Very High (Aggressive pursuit)',
    'Position Limits': 'Flexible (Concentrated positions allowed)',
    'Trading Frequency': 'High (Active market participation)',
    'Leverage': 'High (5x-10x or more)',
    'Risk Metrics': 'Absolute Returns, Recovery Speed',
    'Decision Inputs': 'Real-time data, Momentum, Volatility',
    'Model Requirements': 'Precise execution, Quick adaptation, Stop-loss discipline',
  },
  bespoke: {
    'Core Goal': 'Customized objectives based on user configuration',
    'Risk Tolerance': 'User defined',
    'Position Limits': 'User defined',
    'Trading Frequency': 'User defined',
    'Leverage': 'User defined',
    'Risk Metrics': 'User defined',
    'Decision Inputs': 'User defined',
    'Model Requirements': 'Tailored to specific needs',
  },
};

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

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
function buildServerRequest(config: AILiberoConfig): ServerRequest {
  const taskId = `agent_llm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const llmProvider = config.llm_provider || 'NONA';
  const llmModel = config.llm_model || 'nona-default';

  // Build constraints with bespoke overrides if applicable
  let constraints: TraderModeConstraints = { ...PRESET_MODE_CONSTRAINTS[config.preset_mode] };
  if (config.preset_mode === 'bespoke' && config.bespoke_config) {
    const bc = config.bespoke_config;
    const riskLevel = bc.maxDrawdown <= 10 ? 'Low' : bc.maxDrawdown <= 30 ? 'Medium' : 'High';
    const freqLevel = bc.tradingFrequency <= 10 ? 'Low' : bc.tradingFrequency <= 100 ? 'Medium' : 'High';
    constraints = {
      'Core Goal': 'Customized objectives based on user configuration',
      'Risk Tolerance': riskLevel,
      'Position Limits': `${bc.positionLimits}%`,
      'Trading Frequency': freqLevel,
      'Leverage': `${bc.leverage}x`,
      'Risk Metrics': 'User defined',
      'Decision Inputs': 'User defined',
      'Model Requirements': 'Tailored to specific needs',
    };
  }

  return {
    task_id: taskId,
    locale: 'en_US',
    output_format: 'v3',
    llm_provider: llmProvider,
    llm_model: llmModel,
    storage_mode: config.storage_mode || 'local',
    operation_type: 'generate_strategy',
    operation_data: {
      strategy_name: config.strategy_name || 'Untitled AI Libero Strategy',
      trader_mode: {
        mode: config.preset_mode,
        version: '1.0.0',
        config_source: 'trader-modes.json',
        constraints,
      },
      prediction: {
        batchSize: config.prediction_config.batchSize,
        warmupPeriod: config.prediction_config.warmupPeriod,
        lookbackBars: config.prediction_config.lookbackBars,
        analysisInterval: config.prediction_config.analysisInterval,
      },
      llm: {
        provider: llmProvider,
        model: llmModel,
        timeout: 120,
        retries: 3,
        prompt: config.prompt,
      },
      rawIndicators: transformRawIndicators(config.indicators),
    },
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute AI Libero generation
 *
 * TICKET_077_26: Calls /api/agent_llm which generates
 * agent strategies using LLM-powered prompt analysis.
 */
export async function executeAILibero(
  config: AILiberoConfig
): Promise<AILiberoResult> {
  const requestPayload = buildServerRequest(config);

  console.debug('[AILibero] Calling API:', API_ENDPOINTS.START);
  console.debug('[AILibero] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<AILiberoResult>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,

    // TICKET_417: Centralized poll handler
    handlePollResponse: createStandardPollHandler<AILiberoResult>(
      'AILibero',
      (status, result) => ({
        status: status as AILiberoResult['status'],
        validation_status: result?.validation_status as AILiberoResult['validation_status'],
        reason_code: result?.reason_code as string | undefined,
        strategy_code: result?.strategy_code as string | undefined,
        strategy_id: result?.strategy_id as string | undefined,
        class_name: result?.class_name as string | undefined,
        error: result?.error as AILiberoResult['error'],
      }),
    ),
  });
}

/**
 * Validate AI Libero configuration
 */
export function validateAILiberoConfig(
  config: Partial<AILiberoConfig>
): { valid: boolean; error?: string } {
  if (!config.prompt || config.prompt.trim().length < 10) {
    return { valid: false, error: 'Please enter a prompt (at least 10 characters)' };
  }

  if (config.prompt.length > 10000) {
    return { valid: false, error: 'Prompt is too long (max 10000 characters)' };
  }

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

  // Validate prediction config
  if (config.prediction_config) {
    const pc = config.prediction_config;

    if (pc.batchSize < 50 || pc.batchSize > 500) {
      return { valid: false, error: 'Batch size must be between 50 and 500' };
    }

    if (pc.warmupPeriod < 50 || pc.warmupPeriod > 500) {
      return { valid: false, error: 'Warmup period must be between 50 and 500' };
    }

    if (pc.lookbackBars < 20 || pc.lookbackBars > 200) {
      return { valid: false, error: 'Lookback bars must be between 20 and 200' };
    }

    if (pc.analysisInterval < 1 || pc.analysisInterval > 100) {
      return { valid: false, error: 'Analysis interval must be between 1 and 100' };
    }
  }

  // Validate bespoke config if applicable
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
  }

  return { valid: true };
}

// -----------------------------------------------------------------------------
// Template Storage Functions
// -----------------------------------------------------------------------------

interface TemplateStorage {
  templates: IndicatorTemplate[];
}

/**
 * Load all saved templates using hub state
 */
export async function loadTemplates(): Promise<IndicatorTemplate[]> {
  try {
    const stored = await window.electronAPI.hub.getState(TEMPLATE_STORAGE_KEY) as TemplateStorage | undefined;
    return stored?.templates || [];
  } catch (error) {
    console.error('[AILibero] Failed to load templates:', error);
    return [];
  }
}

/**
 * Save a new template using hub state
 */
export async function saveTemplate(template: IndicatorTemplate): Promise<void> {
  try {
    const stored = await window.electronAPI.hub.getState(TEMPLATE_STORAGE_KEY) as TemplateStorage | undefined;
    const templates = stored?.templates || [];
    templates.push(template);
    window.electronAPI.hub.setState(TEMPLATE_STORAGE_KEY, { templates }, PLUGIN_ID);
  } catch (error) {
    console.error('[AILibero] Failed to save template:', error);
    throw error;
  }
}

/**
 * Delete a template by ID
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    const stored = await window.electronAPI.hub.getState(TEMPLATE_STORAGE_KEY) as TemplateStorage | undefined;
    const templates = (stored?.templates || []).filter(t => t.id !== templateId);
    window.electronAPI.hub.setState(TEMPLATE_STORAGE_KEY, { templates }, PLUGIN_ID);
  } catch (error) {
    console.error('[AILibero] Failed to delete template:', error);
    throw error;
  }
}

/**
 * Get all existing template names (for duplicate check)
 */
export async function getExistingTemplateNames(): Promise<string[]> {
  const templates = await loadTemplates();
  return templates.map(t => t.name);
}

// -----------------------------------------------------------------------------
// Default Configuration
// -----------------------------------------------------------------------------

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

export function getDefaultPredictionConfig(): PredictionConfig {
  return {
    batchSize: 100,
    warmupPeriod: 100,
    lookbackBars: 100,
    analysisInterval: 10,
  };
}

export function getPresetModeDescription(mode: TraderPresetMode): string {
  return PRESET_MODE_CONSTRAINTS[mode]['Core Goal'];
}

/**
 * Vibing Chat Service - AI Strategy Studio Backend Communication
 *
 * Implements HTTP polling communication with /api/vibing_chat endpoints.
 *
 * @see ISSUE_7029_AI_STRATEGY_STUDIO_MESSAGE_FORMAT_SPECIFICATION.md
 */

import { pluginApiClient, ApiResponse } from './api-client';
import { getCurrentUserId } from '../utils/auth-utils';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const API_ENDPOINTS = {
  START: '/api/vibing_chat',
  STATUS: '/api/check_vibing_chat_status',
};

// -----------------------------------------------------------------------------
// Public Types
// -----------------------------------------------------------------------------

/**
 * Strategy rule entry condition
 */
export interface EntryCondition {
  type: string;
  condition: string;
  action?: string;
}

/**
 * Strategy rule exit condition
 */
export interface ExitCondition {
  type: string;
  condition: string;
}

/**
 * Strategy rule indicator
 */
export interface StrategyIndicator {
  name: string;
  params: string;
  description?: string;
}

/**
 * Risk management configuration
 */
export interface RiskManagement {
  stop_loss_pct?: number;
  take_profit_pct?: number;
}

/**
 * Strategy rules from LLM response
 */
export interface StrategyRulesResponse {
  entry_conditions: EntryCondition[];
  exit_conditions: ExitCondition[];
  risk_management: RiskManagement;
  indicators: StrategyIndicator[];
  filters: string[];
  status: 'PARTIAL' | 'COMPLETE';
  missing_fields: string[];
  completeness_score: number;
  detected_language: string;
  is_llm_driven: boolean;
}

/**
 * Vibing chat request configuration
 */
export interface VibingChatRequest {
  session_id: string;
  message: string;
  message_id?: string;
  strategy_id?: string;
  strategy_name?: string;
  locale?: string;
  model?: 'gemini' | 'claude' | 'deepseek' | 'chatgpt' | 'openai' | 'gpt' | 'openrouter' | 'NONA';
  output_format?: 'v1' | 'v3';
  storage_mode?: 'local' | 'remote' | 'hybrid';
  current_strategy_rules?: Partial<StrategyRulesResponse>;
  metadata?: {
    user_id?: number;
    mode?: string;
    timestamp?: string;
  };
  llm_api_key?: string;
  llm_model?: string;
}

/**
 * Vibing chat result from server
 */
export interface VibingChatResult {
  status: 'success' | 'failed';
  type: 'strategy_code' | 'text';
  content: string;
  language?: string | null;
  explanation?: string;
  strategy_id?: string | null;
  strategy_name?: string;
  strategy_type?: number;
  class_name?: string;
  description?: string;
  trading_style?: string;
  classification_metadata?: {
    role?: string;
    style?: string;
    source?: string;
  };
  created_at?: string;
  strategy_rules?: StrategyRulesResponse;
  available_actions?: string[];
  metadata?: {
    indicators_used?: string[];
    fishbone_module?: string;
    fishbone_confidence?: number;
    has_existing_code?: boolean;
  };
}

/**
 * Vibing chat response (full polling response)
 */
export interface VibingChatResponse {
  success: boolean;
  task_id: string;
  session_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: VibingChatResult;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  data?: {
    message?: string;
    processing_time?: number;
    tokens_used?: number;
  };
  metadata?: {
    model?: string;
    model_version?: string | null;
    temperature?: number;
    timestamp?: string;
    fishbone_enabled?: boolean;
    fishbone_module?: string;
    fishbone_confidence?: number;
  };
}

/**
 * Error code to user-friendly message mapping
 */
export const VIBING_CHAT_ERROR_CODE_MESSAGES: Record<string, string> = {
  LLM_ERROR: 'AI model encountered an error. Please try again.',
  CODE_GENERATION_ERROR: 'Failed to generate strategy code. Please try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  RATE_LIMIT: 'Rate limit exceeded. Please wait and try again.',
  INVALID_SESSION: 'Invalid session. Please start a new conversation.',
  AUTH_REQUIRED: 'Please log in to continue.',
};

/**
 * Get user-friendly error message
 */
export function getVibingChatErrorMessage(response: VibingChatResponse): string {
  if (response.error?.code && VIBING_CHAT_ERROR_CODE_MESSAGES[response.error.code]) {
    return VIBING_CHAT_ERROR_CODE_MESSAGES[response.error.code];
  }

  if (response.error?.message) {
    return response.error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// -----------------------------------------------------------------------------
// Request Builder
// -----------------------------------------------------------------------------

/**
 * Build server request from client config
 */
function buildServerRequest(config: VibingChatRequest, userId: number): Record<string, unknown> {
  const taskId = `vibing_chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const messageId = config.message_id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    session_id: config.session_id,
    message: config.message,
    task_id: taskId,
    message_id: messageId,
    strategy_id: config.strategy_id,
    strategy_name: config.strategy_name,
    locale: config.locale || 'en_US',
    model: config.model || 'NONA',
    output_format: config.output_format || 'v3',
    storage_mode: config.storage_mode || 'local',
    current_strategy_rules: config.current_strategy_rules,
    metadata: {
      user_id: userId,
      mode: config.metadata?.mode || 'generator',
      timestamp: config.metadata?.timestamp || new Date().toISOString(),
    },
    llm_api_key: config.llm_api_key,
    llm_model: config.llm_model,
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Execute vibing chat message
 *
 * Sends message to /api/vibing_chat and polls /api/check_vibing_chat_status
 * until completion.
 */
export async function executeVibingChat(
  config: VibingChatRequest
): Promise<VibingChatResponse> {
  const userId = await getCurrentUserId();
  const requestPayload = buildServerRequest(config, userId);

  console.debug('[VibingChat] Calling API:', API_ENDPOINTS.START);
  console.debug('[VibingChat] Request payload:', JSON.stringify(requestPayload, null, 2).substring(0, 1000));

  return await pluginApiClient.executeWithPolling<VibingChatResponse>({
    initialData: requestPayload,
    startEndpoint: API_ENDPOINTS.START,
    pollEndpoint: API_ENDPOINTS.STATUS,
    pollInterval: 500,
    timeout: 180000, // 3 minutes for LLM generation

    handlePollResponse: (response: unknown) => {
      const resp = response as ApiResponse & {
        status?: string;
        result?: VibingChatResult;
        session_id?: string;
        error?: VibingChatResponse['error'];
        data?: VibingChatResponse['data'];
        metadata?: VibingChatResponse['metadata'];
      };

      const status = resp.data?.status || resp.status;
      const isComplete = status === 'completed' || status === 'failed';

      console.debug('[VibingChat] Poll response:', JSON.stringify(resp, null, 2).substring(0, 2000));

      // Extract result from response
      const result = (resp.data?.result || resp.result) as VibingChatResult | undefined;

      return {
        isComplete,
        result: {
          success: resp.success !== false && status !== 'failed',
          task_id: resp.data?.task_id as string || '',
          session_id: resp.session_id || '',
          status: status as VibingChatResponse['status'],
          result: result,
          error: resp.error,
          data: resp.data as VibingChatResponse['data'],
          metadata: resp.metadata,
        } as VibingChatResponse,
        rawResponse: response,
      };
    },
  });
}

/**
 * Execute action trigger (generate_code, save_strategy, run_backtest)
 */
export async function executeVibingChatAction(
  sessionId: string,
  action: 'generate_code' | 'save_strategy' | 'run_backtest',
  currentRules?: Partial<StrategyRulesResponse>,
  llmProvider?: VibingChatRequest['model'],
  llmModel?: string
): Promise<VibingChatResponse> {
  // Action triggers use special message format
  const actionMessage = `<${action}>`;

  return executeVibingChat({
    session_id: sessionId,
    message: actionMessage,
    current_strategy_rules: currentRules,
    output_format: 'v3',
    storage_mode: 'local',
    model: llmProvider,
    llm_model: llmModel,
  });
}

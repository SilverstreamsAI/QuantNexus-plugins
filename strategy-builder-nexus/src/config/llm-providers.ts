/**
 * LLM Provider Configuration
 *
 * Single source of truth for LLM provider definitions.
 * Used by LLMSettingsPanel and manifest.json generation.
 *
 * @see TICKET_089 - LLM Selector Component
 * @see TICKET_090 - LLM API Key Management
 * @see TICKET_092 - Code Placement Violations
 */

// =============================================================================
// Types
// =============================================================================

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  secretKey: string;
  models: LLMModel[];
  apiKeyPlaceholder: string;
  apiKeyPattern?: RegExp;
  docsUrl?: string;
}

// =============================================================================
// Provider Definitions
// =============================================================================

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'CLAUDE',
    name: 'Claude (Anthropic)',
    secretKey: 'llm.claude.apiKey',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPattern: /^sk-ant-/,
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best balance of speed and intelligence' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable model' },
    ],
  },
  {
    id: 'OPENAI',
    name: 'OpenAI',
    secretKey: 'llm.openai.apiKey',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPattern: /^sk-/,
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical' },
    ],
  },
  {
    id: 'GEMINI',
    name: 'Google Gemini',
    secretKey: 'llm.gemini.apiKey',
    apiKeyPlaceholder: 'AIza...',
    apiKeyPattern: /^AIza/,
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
    ],
  },
  {
    id: 'DEEPSEEK',
    name: 'DeepSeek',
    secretKey: 'llm.deepseek.apiKey',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'General chat model' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Code generation' },
    ],
  },
  {
    id: 'GROK',
    name: 'xAI Grok',
    secretKey: 'llm.grok.apiKey',
    apiKeyPlaceholder: 'xai-...',
    apiKeyPattern: /^xai-/,
    docsUrl: 'https://console.x.ai/',
    models: [
      { id: 'grok-2', name: 'Grok 2', description: 'Latest Grok model' },
      { id: 'grok-beta', name: 'Grok Beta', description: 'Beta version' },
    ],
  },
  {
    id: 'QWEN',
    name: 'Alibaba Qwen',
    secretKey: 'llm.qwen.apiKey',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', description: 'Most capable Qwen' },
      { id: 'qwen-plus', name: 'Qwen Plus', description: 'Balanced performance' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: 'Fast responses' },
    ],
  },
];

// =============================================================================
// Derived Values (for manifest.json sync)
// =============================================================================

/** Provider IDs for manifest.json enum */
export const LLM_PROVIDER_IDS = LLM_PROVIDERS.map(p => p.id) as [string, ...string[]];

/** Default provider */
export const DEFAULT_PROVIDER_ID = 'CLAUDE';

/** Default model */
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-20250514';

/** Get provider by ID */
export function getProvider(id: string): LLMProvider | undefined {
  return LLM_PROVIDERS.find(p => p.id === id);
}

/** Get default model for provider */
export function getDefaultModel(providerId: string): string {
  const provider = getProvider(providerId);
  return provider?.models[0]?.id || DEFAULT_MODEL_ID;
}

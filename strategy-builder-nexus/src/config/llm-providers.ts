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

/**
 * TICKET_195: Updated model list (2026 Latest)
 */
export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'NONA',
    name: 'Nona Fast (Default)',
    secretKey: '', // No API key required - always available
    apiKeyPlaceholder: '',
    models: [
      { id: 'nona-fast', name: 'Nona Fast', description: 'Default fast model - no API key required' },
    ],
  },
  {
    id: 'CLAUDE',
    name: 'Claude (Anthropic)',
    secretKey: 'llm.claude.apiKey',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPattern: /^sk-ant-/,
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-4-5-opus-latest', name: 'Claude 4.5 Opus', description: 'Best intelligence' },
      { id: 'claude-4-5-sonnet-latest', name: 'Claude 4.5 Sonnet', description: 'Balanced' },
      { id: 'claude-4-5-haiku-latest', name: 'Claude 4.5 Haiku', description: 'Fast' },
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
      { id: 'gpt-5', name: 'GPT-5', description: 'Flagship' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Cost-effective' },
      { id: 'o3-2025-12-16', name: 'OpenAI O3', description: 'Strongest reasoning' },
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
      { id: 'gemini-3-pro-latest', name: 'Gemini 3 Pro', description: 'Latest flagship' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Latest lightweight' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable, 2M context' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'General purpose' },
      { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', description: 'Chain-of-thought' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Cheapest' },
    ],
  },
  {
    id: 'DEEPSEEK',
    name: 'DeepSeek',
    secretKey: 'llm.deepseek.apiKey',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Best value' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning (O1-like)' },
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
      { id: 'grok-4', name: 'Grok-4', description: 'Flagship' },
    ],
  },
  {
    id: 'QWEN',
    name: 'Alibaba Qwen',
    secretKey: 'llm.qwen.apiKey',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
    models: [
      { id: 'qwen3-max', name: 'Qwen 3 Max', description: 'Best Chinese' },
    ],
  },
];

// =============================================================================
// Derived Values (for manifest.json sync)
// =============================================================================

/** Provider IDs for manifest.json enum */
export const LLM_PROVIDER_IDS = LLM_PROVIDERS.map(p => p.id) as [string, ...string[]];

/** Default provider (always available, no API key required) */
export const DEFAULT_PROVIDER_ID = 'NONA';

/** Default model */
export const DEFAULT_MODEL_ID = 'nona-fast';

/** Get provider by ID */
export function getProvider(id: string): LLMProvider | undefined {
  return LLM_PROVIDERS.find(p => p.id === id);
}

/** Get default model for provider */
export function getDefaultModel(providerId: string): string {
  const provider = getProvider(providerId);
  return provider?.models[0]?.id || DEFAULT_MODEL_ID;
}

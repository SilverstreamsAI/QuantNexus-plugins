/**
 * LLMSettingsPanel - Custom LLM Settings Component for Strategy Builder Plugin
 *
 * Implements TICKET_089 (LLM Selector) and TICKET_090 (API Key Management):
 * - Provider filtering based on configured API keys
 * - Inline API key editing
 * - Model selection per provider
 *
 * @see TICKET_089 - LLM Selector Component
 * @see TICKET_090 - LLM API Key Management
 * @see TICKET_081 - Plugin Settings Architecture (Custom Settings Component)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Brain,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  X,
  RefreshCw,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface LLMModel {
  id: string;
  name: string;
  description?: string;
}

interface LLMProvider {
  id: string;
  name: string;
  secretKey: string;
  models: LLMModel[];
  apiKeyPlaceholder: string;
  apiKeyPattern?: RegExp;
  docsUrl?: string;
}

interface ProviderStatus {
  providerId: string;
  hasApiKey: boolean;
  isConfigured: boolean;
}

interface LLMSettingsPanelProps {
  pluginId: string;
}

// =============================================================================
// LLM Provider Configuration
// =============================================================================

const LLM_PROVIDERS: LLMProvider[] = [
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
// Provider Card Component
// =============================================================================

interface ProviderCardProps {
  provider: LLMProvider;
  pluginId: string;
  isSelected: boolean;
  hasApiKey: boolean;
  selectedModel: string;
  onSelect: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onApiKeyChange: (hasKey: boolean) => void;
}

function ProviderCard({
  provider,
  pluginId,
  isSelected,
  hasApiKey,
  selectedModel,
  onSelect,
  onModelChange,
  onApiKeyChange,
}: ProviderCardProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) {
      setError('API key cannot be empty');
      return;
    }

    // Validate pattern if defined
    if (provider.apiKeyPattern && !provider.apiKeyPattern.test(apiKeyValue)) {
      setError(`Invalid API key format for ${provider.name}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await window.electronAPI.credential.set(
        pluginId,
        provider.secretKey,
        apiKeyValue
      );

      if (result.success) {
        setEditing(false);
        setApiKeyValue('');
        onApiKeyChange(true);
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (e) {
      setError(`Error: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    try {
      await window.electronAPI.credential.delete(pluginId, provider.secretKey);
      onApiKeyChange(false);
    } catch (e) {
      setError(`Error: ${e}`);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setApiKeyValue('');
    setError(null);
  };

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isSelected
          ? 'border-color-terminal-accent-teal bg-color-terminal-accent-teal/5'
          : hasApiKey
          ? 'border-white/20 hover:border-white/30'
          : 'border-white/10 hover:border-white/20 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              hasApiKey ? 'bg-green-500/10' : 'bg-yellow-500/10'
            }`}
          >
            <Brain className={`h-5 w-5 ${hasApiKey ? 'text-green-500' : 'text-yellow-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{provider.name}</span>
              {hasApiKey ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {hasApiKey ? 'API key configured' : 'API key required'}
            </div>
          </div>
        </div>

        {/* Select Button */}
        {hasApiKey && (
          <button
            onClick={() => onSelect(provider.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isSelected
                ? 'bg-color-terminal-accent-teal text-black'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        )}
      </div>

      {/* API Key Section */}
      <div className="mb-3">
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder={provider.apiKeyPlaceholder}
                  className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 pr-10 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={saving}
                className="rounded-lg p-2 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
              <button
                onClick={handleCancel}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
            {provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-color-terminal-accent-teal hover:underline"
              >
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Key className="h-4 w-4" />
              {hasApiKey ? 'Update API Key' : 'Set API Key'}
            </button>
            {hasApiKey && (
              <button
                onClick={handleDeleteApiKey}
                className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {/* Model Selection (only if has API key and is selected) */}
      {hasApiKey && isSelected && (
        <div className="pt-3 border-t border-white/10">
          <label className="block text-xs text-muted-foreground mb-2">Model</label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-white/20 bg-black/50 px-3 py-2 pr-10 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
            >
              {provider.models.map((model) => (
                <option key={model.id} value={model.id} className="bg-color-terminal-panel">
                  {model.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {provider.models.find((m) => m.id === selectedModel)?.description && (
            <div className="mt-1 text-xs text-muted-foreground">
              {provider.models.find((m) => m.id === selectedModel)?.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function LLMSettingsPanel({ pluginId }: LLMSettingsPanelProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('CLAUDE');
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514');

  // Load provider statuses and current selection
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load API key statuses
      const statuses: ProviderStatus[] = [];
      for (const provider of LLM_PROVIDERS) {
        const hasResult = await window.electronAPI.credential.has(pluginId, provider.secretKey);
        statuses.push({
          providerId: provider.id,
          hasApiKey: hasResult.exists,
          isConfigured: hasResult.exists,
        });
      }
      setProviderStatuses(statuses);

      // Load current selection from plugin config
      const configResult = await window.electronAPI.plugin.getConfig(pluginId);
      if (configResult.success && configResult.config) {
        const config = configResult.config;
        if (config['llm.selectedProvider']) {
          setSelectedProvider(config['llm.selectedProvider'] as string);
        }
        if (config['llm.selectedModel']) {
          setSelectedModel(config['llm.selectedModel'] as string);
        }
      }
    } catch (e) {
      console.error('Failed to load LLM settings:', e);
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle provider selection
  const handleSelectProvider = async (providerId: string) => {
    setSelectedProvider(providerId);

    // Set default model for provider
    const provider = LLM_PROVIDERS.find((p) => p.id === providerId);
    if (provider && provider.models.length > 0) {
      setSelectedModel(provider.models[0].id);
    }

    // Save to plugin config
    try {
      await window.electronAPI.plugin.setConfig(pluginId, 'llm.selectedProvider', providerId);
      if (provider && provider.models.length > 0) {
        await window.electronAPI.plugin.setConfig(pluginId, 'llm.selectedModel', provider.models[0].id);
      }
    } catch (e) {
      console.error('Failed to save provider selection:', e);
    }
  };

  // Handle model selection
  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    try {
      await window.electronAPI.plugin.setConfig(pluginId, 'llm.selectedModel', modelId);
    } catch (e) {
      console.error('Failed to save model selection:', e);
    }
  };

  // Handle API key change
  const handleApiKeyChange = (providerId: string, hasKey: boolean) => {
    setProviderStatuses((prev) =>
      prev.map((s) =>
        s.providerId === providerId ? { ...s, hasApiKey: hasKey, isConfigured: hasKey } : s
      )
    );

    // If current provider lost its key, switch to first available
    if (!hasKey && selectedProvider === providerId) {
      const firstConfigured = providerStatuses.find(
        (s) => s.providerId !== providerId && s.hasApiKey
      );
      if (firstConfigured) {
        handleSelectProvider(firstConfigured.providerId);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const configuredCount = providerStatuses.filter((s) => s.hasApiKey).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Brain className="h-5 w-5 text-color-terminal-accent-teal" />
          LLM Provider Settings
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure API keys for AI-powered code generation. Only providers with configured API keys will be available for selection.
        </p>
      </div>

      {/* Status Summary */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {configuredCount} of {LLM_PROVIDERS.length} providers configured
            </div>
            <div className="text-xs text-muted-foreground">
              {configuredCount === 0
                ? 'Configure at least one provider to use AI features'
                : `Active: ${LLM_PROVIDERS.find((p) => p.id === selectedProvider)?.name || 'None'}`}
            </div>
          </div>
          {configuredCount === 0 && (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-4">
        {LLM_PROVIDERS.map((provider) => {
          const status = providerStatuses.find((s) => s.providerId === provider.id);
          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              pluginId={pluginId}
              isSelected={selectedProvider === provider.id}
              hasApiKey={status?.hasApiKey || false}
              selectedModel={selectedProvider === provider.id ? selectedModel : provider.models[0]?.id || ''}
              onSelect={handleSelectProvider}
              onModelChange={handleModelChange}
              onApiKeyChange={(hasKey) => handleApiKeyChange(provider.id, hasKey)}
            />
          );
        })}
      </div>

      {/* Security Note */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Key className="h-4 w-4 mt-0.5 text-color-terminal-accent-teal" />
          <div>
            <div className="font-medium text-white mb-1">Security</div>
            <ul className="space-y-1">
              <li>API keys are encrypted using system-level encryption</li>
              <li>Keys are stored locally and never uploaded to cloud</li>
              <li>Each provider connection is isolated</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { LLMSettingsPanelProps };

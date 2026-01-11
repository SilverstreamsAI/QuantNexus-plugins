/**
 * ConfigTab - Plugin configuration settings UI
 *
 * TICKET_093: Plugin Settings UI Decoupling
 * Migrated from Host layer to Plugin layer for full plugin autonomy.
 *
 * TICKET_090: Dynamic provider filtering
 * Only shows providers with configured API keys in llm.selectedProvider dropdown.
 *
 * @see TICKET_093 - Plugin Settings Decoupling
 * @see TICKET_090 - LLM API Key Management
 * @see TICKET_081 - Plugin Settings Architecture
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings,
  RefreshCw,
  AlertTriangle,
  Info,
  KeyRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LLM_PROVIDERS, getDefaultModel } from '../../config/llm-providers';

// =============================================================================
// Types
// =============================================================================

interface ConfigTabProps {
  pluginId: string;
}

interface ConfigurationProperty {
  type: string;
  description?: string;
  secret?: boolean;
  default?: unknown;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  category?: string;
  order?: number;
}

interface ConfigurationContribution {
  title?: string;
  properties: Record<string, ConfigurationProperty>;
}

interface CategoryGroup {
  name: string;
  properties: Array<{
    key: string;
    property: ConfigurationProperty;
  }>;
}

// =============================================================================
// Field Components
// =============================================================================

interface FieldProps {
  label: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, description, error, children }: FieldProps): JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

interface ConfigFieldProps {
  propertyKey: string;
  property: ConfigurationProperty;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  /** TICKET_090: Filtered enum options (for llm.selectedProvider) */
  filteredEnum?: string[];
  /** TICKET_090: Message when no options available */
  emptyMessage?: string;
}

function ConfigField({ propertyKey, property, value, onChange, filteredEnum, emptyMessage }: ConfigFieldProps): JSX.Element {
  // Extract field label from key (e.g., "strategy.autoSave" -> "Auto Save")
  const label = propertyKey.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim() || propertyKey;
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const handleChange = (newValue: unknown) => {
    onChange(propertyKey, newValue);
  };

  // Render appropriate input based on type
  switch (property.type) {
    case 'boolean':
      return (
        <Field label={capitalizedLabel} description={property.description}>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={value as boolean ?? property.default as boolean ?? false}
              onChange={(e) => handleChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">Enable</span>
          </div>
        </Field>
      );

    case 'number':
      return (
        <Field label={capitalizedLabel} description={property.description}>
          <input
            type="number"
            value={value as number ?? property.default as number ?? 0}
            onChange={(e) => handleChange(Number(e.target.value))}
            min={property.minimum}
            max={property.maximum}
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
          />
        </Field>
      );

    case 'string':
      // Check if it's an enum (dropdown)
      if (property.enum && property.enum.length > 0) {
        // TICKET_090: Use filtered enum if provided
        const enumOptions = filteredEnum ?? property.enum;

        // Show empty message if no options available
        if (enumOptions.length === 0 && emptyMessage) {
          return (
            <Field label={capitalizedLabel} description={property.description}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                <KeyRound className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-500">{emptyMessage}</span>
              </div>
            </Field>
          );
        }

        return (
          <Field label={capitalizedLabel} description={property.description}>
            <select
              value={value as string ?? property.default as string ?? ''}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
            >
              {enumOptions.map((option) => {
                // Find original index in property.enum for description lookup
                const originalIndex = property.enum?.indexOf(option) ?? -1;
                return (
                  <option key={option} value={option} className="bg-color-terminal-panel">
                    {originalIndex >= 0 ? property.enumDescriptions?.[originalIndex] || option : option}
                  </option>
                );
              })}
            </select>
          </Field>
        );
      }

      // Regular text input (skip secret fields - handled in SecretsTab)
      if (property.secret) {
        return <></>;
      }

      return (
        <Field label={capitalizedLabel} description={property.description}>
          <input
            type="text"
            value={value as string ?? property.default as string ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
          />
        </Field>
      );

    default:
      return (
        <Field label={capitalizedLabel} description={property.description}>
          <div className="text-sm text-muted-foreground">
            Unsupported type: {property.type}
          </div>
        </Field>
      );
  }
}

// =============================================================================
// Section Component
// =============================================================================

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, title, children }: SectionProps): JSX.Element {
  return (
    <div id={id} className="rounded-lg border border-white/10 scroll-mt-4">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Settings className="h-5 w-5 text-color-terminal-accent-teal" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ConfigTab({ pluginId }: ConfigTabProps): JSX.Element {
  const [configuration, setConfiguration] = useState<ConfigurationContribution | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  // TICKET_090: Track which LLM providers have API keys configured
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);

  // Load configuration from manifest via IPC
  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const manifestResult = await window.electronAPI.plugin.getManifest(pluginId);

      if (!manifestResult.success) {
        setError(`Plugin not found: ${pluginId}`);
        return;
      }

      const manifest = manifestResult.manifest as {
        contributes?: {
          configuration?: ConfigurationContribution;
        };
      };

      const config = manifest?.contributes?.configuration || null;
      setConfiguration(config);

      // Load saved values
      const configResult = await window.electronAPI.plugin.getConfig(pluginId);
      if (configResult.success && configResult.config) {
        setValues(configResult.config);
      } else if (config) {
        // Use defaults
        const defaults: Record<string, unknown> = {};
        for (const [key, prop] of Object.entries(config.properties)) {
          if (prop.default !== undefined) {
            defaults[key] = prop.default;
          }
        }
        setValues(defaults);
      }

      // TICKET_090: Check which LLM providers have API keys configured
      const configured: string[] = [];
      for (const provider of LLM_PROVIDERS) {
        const hasResult = await window.electronAPI.credential.has(pluginId, provider.secretKey);
        if (hasResult.exists) {
          configured.push(provider.id);
        }
      }
      setConfiguredProviders(configured);

    } catch (e) {
      setError(`Failed to load configuration: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Group properties by category (exclude secrets)
  const categories = useMemo((): CategoryGroup[] => {
    if (!configuration) return [];

    const groups: Record<string, CategoryGroup> = {};
    const properties = Object.entries(configuration.properties)
      .filter(([, prop]) => !prop.secret) // Exclude secrets (shown in Secrets tab)
      .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999));

    for (const [key, prop] of properties) {
      const category = prop.category || 'General';
      if (!groups[category]) {
        groups[category] = { name: category, properties: [] };
      }
      groups[category].properties.push({ key, property: prop });
    }

    return Object.values(groups);
  }, [configuration]);

  // Handle value change
  const handleChange = useCallback(async (key: string, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }));

    // Save to config
    try {
      await window.electronAPI.plugin.setConfig(pluginId, key, value);

      // TICKET_090: When provider changes, auto-select default model
      if (key === 'llm.selectedProvider' && typeof value === 'string') {
        const defaultModel = getDefaultModel(value);
        setValues(prev => ({ ...prev, 'llm.selectedModel': defaultModel }));
        await window.electronAPI.plugin.setConfig(pluginId, 'llm.selectedModel', defaultModel);
      }
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }, [pluginId]);

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  }, []);

  // Set initial active section
  useEffect(() => {
    if (categories.length > 0 && !activeSection) {
      setActiveSection(categories[0].name.toLowerCase().replace(/\s+/g, '-'));
    }
  }, [categories, activeSection]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
          <p className="mt-4 text-muted-foreground">{error}</p>
          <button
            onClick={loadConfiguration}
            className="mt-4 px-4 py-2 rounded-lg bg-color-terminal-accent-teal text-black text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!configuration || categories.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Info className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            No configuration options available
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            All settings are managed in the Secrets tab
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Navigation */}
      <nav className="w-48 flex-shrink-0 border-r border-white/10 p-4">
        <div className="space-y-1">
          {categories.map((category) => {
            const sectionId = category.name.toLowerCase().replace(/\s+/g, '-');
            const isActive = activeSection === sectionId;
            return (
              <button
                key={category.name}
                onClick={() => scrollToSection(sectionId)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  isActive
                    ? "text-color-terminal-accent-teal"
                    : "text-muted-foreground hover:text-color-terminal-accent-teal"
                )}
              >
                <Settings className="w-4 h-4" />
                <span>{category.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-color-terminal-accent-teal/10">
                <Settings className="h-6 w-6 text-color-terminal-accent-teal" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{configuration.title || 'Configuration'}</h1>
                <p className="text-muted-foreground">
                  Plugin settings
                </p>
              </div>
            </div>

            <button
              onClick={loadConfiguration}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </button>
          </div>

          {/* Sections */}
          {categories.map((category) => {
            const sectionId = category.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <Section key={category.name} id={sectionId} title={category.name}>
                <div className="space-y-4">
                  {category.properties.map(({ key, property }) => {
                    // TICKET_090: Special handling for llm.selectedProvider
                    const isProviderSelector = key === 'llm.selectedProvider';
                    const filteredEnum = isProviderSelector ? configuredProviders : undefined;
                    const emptyMessage = isProviderSelector
                      ? 'No providers configured. Add API keys in the Secrets tab first.'
                      : undefined;

                    return (
                      <ConfigField
                        key={key}
                        propertyKey={key}
                        property={property}
                        value={values[key]}
                        onChange={handleChange}
                        filteredEnum={filteredEnum}
                        emptyMessage={emptyMessage}
                      />
                    );
                  })}
                </div>
              </Section>
            );
          })}

          {/* Info Footer */}
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>
                  Plugin ID: <code className="bg-white/10 px-1 py-0.5 rounded text-xs">{pluginId}</code>
                </p>
                <p className="mt-1">
                  Configuration schema defined in plugin manifest.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigTab;

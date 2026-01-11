/**
 * SecretsTab - Plugin secrets management UI
 *
 * TICKET_093: Plugin Settings UI Decoupling
 * Migrated from Host layer to Plugin layer for full plugin autonomy.
 *
 * @see TICKET_093 - Plugin Settings Decoupling
 * @see TICKET_081 - Plugin Settings Architecture
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Key,
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Copy,
  Search,
  ClipboardList,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LLM_PROVIDERS } from '../../config/llm-providers';

// =============================================================================
// Types
// =============================================================================

interface SecretsTabProps {
  pluginId: string;
}

interface ConfigurationProperty {
  type: string;
  description?: string;
  secret?: boolean;
  default?: unknown;
}

interface Credential {
  key: string;
  hasValue: boolean;
  description?: string;
  fromManifest?: boolean;
  docsUrl?: string;
}

interface ActivityLogEntry {
  timestamp: number;
  action: string;
  key: string;
  success: boolean;
}

// =============================================================================
// Navigation Configuration
// =============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'status', label: 'Status', icon: ShieldCheck },
  { id: 'credentials', label: 'Credentials', icon: Key },
  { id: 'activity', label: 'Activity', icon: ClipboardList },
];

// =============================================================================
// Credential Item Component
// =============================================================================

interface CredentialItemProps {
  credential: Credential;
  pluginId: string;
  onUpdate: () => void;
}

function CredentialItem({ credential, pluginId, onUpdate }: CredentialItemProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleView = async () => {
    if (showValue) {
      setShowValue(false);
      setValue(null);
      return;
    }

    setLoading(true);
    try {
      const result = await window.electronAPI.credential.get(pluginId, credential.key);
      if (result.success && result.value) {
        setValue(result.value);
        setShowValue(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (value) {
      await navigator.clipboard.writeText(value);
    }
  };

  const handleSave = async () => {
    if (!inputValue.trim()) {
      setError('Value cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.credential.set(pluginId, credential.key, inputValue);
      if (result.success) {
        setEditing(false);
        setInputValue('');
        onUpdate();
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (e) {
      setError(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete secret "${credential.key}"?`)) return;

    try {
      await window.electronAPI.credential.delete(pluginId, credential.key);
      onUpdate();
    } catch (e) {
      setError(`Error: ${e}`);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setInputValue('');
    setError(null);
  };

  return (
    <div className="rounded-lg border border-white/10 p-4 hover:border-color-terminal-accent-teal/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            credential.hasValue ? 'bg-green-500/10' : 'bg-yellow-500/10'
          }`}>
            <Key className={`h-5 w-5 ${credential.hasValue ? 'text-green-500' : 'text-yellow-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{credential.key}</span>
              {credential.hasValue ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              {credential.fromManifest && (
                <span className="text-[10px] px-1.5 py-0.5 bg-color-terminal-accent-teal/20 rounded text-color-terminal-accent-teal">
                  Required
                </span>
              )}
            </div>
            {credential.description && (
              <p className="text-xs text-muted-foreground">{credential.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showValue && value && (
            <div className="flex items-center gap-2 rounded bg-white/5 px-3 py-1.5">
              <code className="text-sm font-mono">
                {value.length > 20 ? `${value.substring(0, 20)}...` : value}
              </code>
              <button
                onClick={handleCopy}
                className="rounded p-1 hover:bg-white/10"
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}

          {credential.hasValue && (
            <button
              onClick={handleView}
              disabled={loading}
              className="rounded-lg p-2 hover:bg-white/5"
              title={showValue ? 'Hide value' : 'Show value'}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : showValue ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            onClick={() => setEditing(true)}
            className="rounded-lg p-2 hover:bg-white/5 text-color-terminal-accent-teal"
            title={credential.hasValue ? 'Edit' : 'Set value'}
          >
            <Edit3 className="h-4 w-4" />
          </button>

          {credential.hasValue && (
            <button
              onClick={handleDelete}
              className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
              title="Delete credential"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter secret value"
                className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={handleSave}
              disabled={loading || !inputValue.trim()}
              className="rounded-lg px-4 py-2 bg-color-terminal-accent-teal text-black text-sm font-medium hover:bg-color-terminal-accent-teal/90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
          {error && <div className="text-xs text-red-500">{error}</div>}
          {credential.docsUrl && (
            <a
              href={credential.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-color-terminal-accent-teal hover:underline"
            >
              Get API key <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Activity Log Component
// =============================================================================

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

function ActivityLog({ entries }: ActivityLogProps): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="font-medium">Recent Activity</h3>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            No activity recorded
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((entry, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                {entry.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">{entry.key}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SecretsTab({ pluginId }: SecretsTabProps): JSX.Element {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('status');

  // Get secret properties from manifest via IPC
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get manifest via IPC
      const manifestResult = await window.electronAPI.plugin.getManifest(pluginId);
      const manifest = manifestResult.success ? manifestResult.manifest as {
        contributes?: {
          configuration?: {
            properties?: Record<string, ConfigurationProperty>;
          };
        };
      } : null;

      // Build credentials list from manifest + LLM providers
      const credMap = new Map<string, Credential>();

      // Add manifest-declared secrets
      if (manifest?.contributes?.configuration?.properties) {
        for (const [key, prop] of Object.entries(manifest.contributes.configuration.properties)) {
          if (prop.secret === true) {
            // Find matching LLM provider for docsUrl
            const provider = LLM_PROVIDERS.find(p => p.secretKey === key);
            credMap.set(key, {
              key,
              hasValue: false,
              description: prop.description,
              fromManifest: true,
              docsUrl: provider?.docsUrl,
            });
          }
        }
      }

      // Check stored credentials
      const listResult = await window.electronAPI.credential.list(pluginId);
      if (listResult.success) {
        for (const key of listResult.keys) {
          const hasResult = await window.electronAPI.credential.has(pluginId, key);
          const existing = credMap.get(key);
          if (existing) {
            existing.hasValue = hasResult.exists;
          } else {
            credMap.set(key, {
              key,
              hasValue: hasResult.exists,
              fromManifest: false,
            });
          }
        }
      }

      // Sort: manifest secrets first, then alphabetically
      const sortedCreds = Array.from(credMap.values()).sort((a, b) => {
        if (a.fromManifest && !b.fromManifest) return -1;
        if (!a.fromManifest && b.fromManifest) return 1;
        return a.key.localeCompare(b.key);
      });

      setCredentials(sortedCreds);

      // Load audit log
      const auditResult = await window.electronAPI.credential.getAuditLog(pluginId, 20);
      if (auditResult.success) {
        setActivityLog(
          auditResult.entries.map((e: { timestampMillis: number; action: string; key: string; success: boolean }) => ({
            timestamp: e.timestampMillis,
            action: e.action,
            key: e.key,
            success: e.success,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter credentials
  const filteredCredentials = credentials.filter((c) =>
    c.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  const configuredCount = credentials.filter((c) => c.hasValue).length;

  return (
    <div className="h-full flex">
      {/* Left Navigation */}
      <nav className="w-48 flex-shrink-0 border-r border-white/10 p-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "text-color-terminal-accent-teal"
                    : "text-muted-foreground hover:text-color-terminal-accent-teal"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
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
                <Shield className="h-6 w-6 text-color-terminal-accent-teal" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Secrets</h1>
                <p className="text-muted-foreground">
                  Manage API keys and credentials
                </p>
              </div>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Security Status */}
          <div id="status" className="rounded-lg border border-white/10 p-4 scroll-mt-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-color-terminal-accent-teal" />
              <div>
                <h3 className="font-medium">Security Status</h3>
                <p className="text-sm text-muted-foreground">
                  {configuredCount} of {credentials.length} secrets configured.
                  Secrets are encrypted with AES-256-GCM and stored securely.
                </p>
              </div>
            </div>
          </div>

          {/* Credentials Section */}
          <div id="credentials" className="space-y-4 scroll-mt-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search secrets..."
                className="w-full rounded-lg border border-white/10 bg-transparent py-2 pl-10 pr-4 text-sm focus:border-color-terminal-accent-teal focus:outline-none"
              />
            </div>

            {/* Credentials List */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Stored Secrets</h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCredentials.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 py-12 text-center">
                  <Key className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">
                    {searchQuery ? 'No secrets match your search' : 'No secrets configured'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCredentials.map((credential) => (
                    <CredentialItem
                      key={credential.key}
                      credential={credential}
                      pluginId={pluginId}
                      onUpdate={loadData}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div id="activity" className="scroll-mt-4">
            <ActivityLog entries={activityLog} />
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
      </div>
    </div>
  );
}

export default SecretsTab;

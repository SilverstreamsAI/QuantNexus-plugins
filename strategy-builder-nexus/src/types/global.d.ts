/**
 * Global Type Declarations for Strategy Builder Plugin
 *
 * Extends Window interface to include electronAPI types
 * that are exposed by the Host's preload script.
 */

interface CredentialResult {
  success: boolean;
  error?: string;
}

interface CredentialGetResult extends CredentialResult {
  value?: string;
}

interface CredentialHasResult {
  exists: boolean;
}

interface CredentialListResult extends CredentialResult {
  keys: string[];
}

interface PluginConfigResult {
  success: boolean;
  config?: Record<string, unknown>;
  error?: string;
}

interface CredentialAuditEntry {
  timestampMillis: number;
  action: string;
  key: string;
  success: boolean;
}

interface CredentialAuditResult extends CredentialResult {
  entries: CredentialAuditEntry[];
}

interface ElectronCredentialAPI {
  get(pluginId: string, key: string): Promise<CredentialGetResult>;
  set(pluginId: string, key: string, value: string): Promise<CredentialResult>;
  delete(pluginId: string, key: string): Promise<CredentialResult>;
  has(pluginId: string, key: string): Promise<CredentialHasResult>;
  list(pluginId: string): Promise<CredentialListResult>;
  getAuditLog(pluginId: string, maxEntries?: number): Promise<CredentialAuditResult>;
}

interface PluginManifestResult {
  success: boolean;
  manifest?: unknown;
  error?: string;
}

interface ElectronPluginAPI {
  getManifest(pluginId: string): Promise<PluginManifestResult>;
  getConfig(pluginId: string): Promise<PluginConfigResult>;
  setConfig(pluginId: string, key: string, value: unknown): Promise<CredentialResult>;
}

interface ElectronAPI {
  credential: ElectronCredentialAPI;
  plugin: ElectronPluginAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

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

interface HubEntityResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

interface ElectronHubAPI {
  invokeEntity(action: string, entity: string, payload: any, pluginId: string): Promise<HubEntityResult>;
  transaction(operations: any[], pluginId: string): Promise<HubEntityResult>;
  setState(key: string, value: any, pluginId: string): void;
  getState(key: string): Promise<any>;
  getAllState(): Promise<any>;
  onStateChanged(callback: (data: any) => void): () => void;
  emit(type: string, payload: any, pluginId: string): void;
  replay(type: string): Promise<any>;
  onEvent(callback: (data: any) => void): () => void;
  findFiles(query: any, pluginId: string): Promise<any>;
  resolveFile(fileId: string, pluginId: string): Promise<any>;
  removeFile(fileId: string, deleteFile: boolean, pluginId: string): Promise<any>;
}

interface ElectronAPI {
  credential: ElectronCredentialAPI;
  plugin: ElectronPluginAPI;
  hub: ElectronHubAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  // Host-injected nexus API (TICKET_096)
  // eslint-disable-next-line no-var
  var nexus: {
    window?: {
      showAlert(message: string): void;
      showConfirm(message: string): Promise<boolean>;
      showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
    };
  } | undefined;
}

export {};

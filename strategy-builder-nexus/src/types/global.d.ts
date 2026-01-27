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

// TICKET_192: API Key Validation Result
interface ApiKeyValidationData {
  valid: boolean;
  error?: string;
  errorCode?: 'INVALID_FORMAT' | 'AUTH_FAILED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN';
  provider: string;
}

interface ApiKeyValidationResult {
  success: boolean;
  data?: ApiKeyValidationData;
  errorMessage?: string;
}

interface ElectronCredentialAPI {
  get(pluginId: string, key: string): Promise<CredentialGetResult>;
  set(pluginId: string, key: string, value: string): Promise<CredentialResult>;
  delete(pluginId: string, key: string): Promise<CredentialResult>;
  has(pluginId: string, key: string): Promise<CredentialHasResult>;
  list(pluginId: string): Promise<CredentialListResult>;
  getAuditLog(pluginId: string, maxEntries?: number): Promise<CredentialAuditResult>;
  // TICKET_192: API Key Validation
  validateApiKey(provider: string, apiKey: string): Promise<ApiKeyValidationResult>;
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

// TICKET_184: Auth API for JWT token injection
interface ElectronAuthAPI {
  getAccessToken(): Promise<{ success: boolean; data?: string | null; error?: string }>;
  refresh(): Promise<{ success: boolean; error?: string }>;
  login(providerName?: string): Promise<{ success: boolean; data?: { authUrl: string }; error?: string }>;
  logout(): Promise<{ success: boolean; error?: string }>;
}

// TICKET_190: LLM Access Result
interface LLMAccessResult {
  allowed: boolean;
  source: 'platform' | 'byok' | 'none';
  reason: 'platform_key' | 'byok_configured' | 'no_key' | 'default_provider';
  requiresBYOK: boolean;
  userTier: string | null;
  configuredProvider?: string;
}

// TICKET_194/195: LLM Provider Info with verification status and models
interface LLMProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  status: 'platform' | 'verified' | 'unverified';
  defaultModel: string;
  models: Array<{ id: string; name: string }>; // TICKET_195
}

// TICKET_193: API Key Resolution Result
interface ApiKeyResolution {
  source: 'platform' | 'byok' | 'none';
  key?: string;
  providerId: string;
}

// TICKET_190: Entitlement API
// TICKET_194: Added setLLMProviderValidationStatus, getLLMProvidersWithStatus
// TICKET_193: Added resolveLLMApiKey
interface ElectronEntitlementAPI {
  canAccessLLMFeatures(): Promise<{ success: boolean; data?: LLMAccessResult; error?: string }>;
  getConfiguredBYOKProviders(): Promise<{ success: boolean; data?: string[]; error?: string }>;
  getLLMProvidersWithStatus(): Promise<{ success: boolean; data?: LLMProviderInfo[]; error?: string }>;
  setLLMProviderValidationStatus(providerId: string, validated: boolean): Promise<{ success: boolean; error?: string }>;
  resolveLLMApiKey(providerId: string): Promise<{ success: boolean; data?: ApiKeyResolution; error?: string }>;
}

// TICKET_205: Kronos Predictor API
interface KronosPredictionRequest {
  model: string;
  lookback: number;
  pred_len: number;
  temperature: number;
  top_p: number;
  top_k: number;
  sample_count: number;
  time_range: 'latest' | 'custom';
  start_time?: string;
  strategy_name: string;
  signal_filter: {
    filters: {
      confidence: { enabled: boolean; min_value: number };
      expected_return: { enabled: boolean; min_value: number };
      direction_filter: { enabled: boolean; mode: string };
      magnitude: { enabled: boolean; min_value: number };
      consistency: { enabled: boolean; min_value: number };
    };
    combination_logic: 'AND' | 'OR';
  };
}

interface KronosPrediction {
  direction: 'buy' | 'sell' | 'hold';
  confidence: number;
  expectedReturn: number;
  magnitude: number;
}

interface KronosSignal {
  timestamp: number;
  direction: 'buy' | 'sell';
  confidence: number;
  expectedReturn: number;
}

interface ElectronKronosAPI {
  predict(request: KronosPredictionRequest): Promise<{
    success: boolean;
    taskId?: string;
    // Synchronous result fields (TICKET_206)
    strategyCode?: string;
    className?: string;
    strategyName?: string;
    // Legacy prediction fields
    prediction?: KronosPrediction;
    error?: string;
  }>;
  cancel(taskId: string): Promise<{
    success: boolean;
    taskId?: string;
    error?: string;
  }>;
  getModels(): Promise<{
    success: boolean;
    models?: Array<{
      id: string;
      name: string;
      params: string;
      maxContext: number;
    }>;
    error?: string;
  }>;
  onProgress(callback: (data: {
    taskId: string;
    status: string;
    progress: number;
  }) => void): () => void;
  onComplete(callback: (data: {
    taskId: string;
    result: {
      success: boolean;
      // Strategy code generation result (from backend)
      strategy_code?: string;
      class_name?: string;
      strategy_name?: string;
      // Legacy prediction fields
      prediction?: KronosPrediction;
      signals?: KronosSignal[];
    };
  }) => void): () => void;
  onError(callback: (data: {
    taskId?: string;
    message: string;
  }) => void): () => void;
}

// TICKET_212: Database API for algorithm queries
interface AlgorithmRecord {
  id: number;
  code: string;
  strategy_name: string;
  strategy_type: number;
  description: string | null;
  classification_metadata?: string; // JSON string
}

interface ElectronDatabaseAPI {
  getAlgorithms: (params: {
    userId: string;
    strategyType: number | number[];
    signalSourcePrefix?: string;
  }) => Promise<{
    success: boolean;
    data?: AlgorithmRecord[];
    error?: { code: string; message: string };
  }>;
}

interface ElectronAPI {
  credential: ElectronCredentialAPI;
  plugin: ElectronPluginAPI;
  hub: ElectronHubAPI;
  auth?: ElectronAuthAPI;
  entitlement: ElectronEntitlementAPI; // TICKET_190
  kronos: ElectronKronosAPI; // TICKET_205
  database: ElectronDatabaseAPI; // TICKET_212
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  // Host-injected nexus API (TICKET_096)
  // eslint-disable-next-line no-var
  var nexus: {
    window?: {
      showAlert(message: string, options?: { title?: string }): Promise<void>;
      showConfirm(message: string, options?: { title?: string }): Promise<boolean>;
      showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
      openExternal?(url: string): void; // TICKET_190
    };
  } | undefined;
}

export {};

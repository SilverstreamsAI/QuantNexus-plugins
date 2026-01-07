/**
 * Data Source Nexus - Backend Module Entry Point
 *
 * This is the Node.js-compatible entry point for the Data Source Nexus plugin backend.
 * It initializes storage, cache, and data providers, and registers IPC handlers.
 *
 * @see TICKET_061 - Data Nexus Architecture Refactor
 */

import type { IpcMain } from 'electron';
import { DataPluginStorage } from './storage/sqlite';
import { DataPluginCache } from './storage/cache';
import { ClickHouseProvider } from './providers/clickhouse';
import { CSVProvider } from './providers/csv';
import {
  registerDataIPCHandlers,
  unregisterDataIPCHandlers,
  type DataBackendContext,
} from './ipc/handlers';

// =============================================================================
// Configuration
// =============================================================================

export interface DataBackendConfig {
  storage?: {
    dbPath: string;
    walMode?: boolean;
    cacheSize?: number;
  };
  cache?: {
    maxMemoryMB: number;
    defaultTTL?: number;
  };
  providers?: {
    clickhouse?: {
      enabled: boolean;
      baseUrl?: string;
      apiKey?: string;
      apiSecret?: string;
    };
    csv?: {
      enabled: boolean;
      dataDir?: string;
    };
  };
  defaultProvider?: string;
}

// Default configuration
const DEFAULT_CONFIG: DataBackendConfig = {
  storage: {
    dbPath: 'data/market.db',
  },
  cache: {
    maxMemoryMB: 256,
    defaultTTL: 300000, // 5 minutes
  },
  providers: {
    clickhouse: {
      enabled: true,
      baseUrl: 'https://clickhouse.silvonastream.com',
    },
    csv: {
      enabled: true,
    },
  },
  defaultProvider: 'clickhouse',
};

// =============================================================================
// Backend State
// =============================================================================

let backendContext: DataBackendContext | null = null;
let initialized = false;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the Data Source Nexus backend
 *
 * This should be called from the Electron main process during app startup.
 */
export async function initializeDataBackend(
  ipcMain: IpcMain,
  config: DataBackendConfig = DEFAULT_CONFIG
): Promise<void> {
  if (initialized) {
    console.warn('[DataPlugin Backend] Already initialized');
    return;
  }

  console.info('[DataPlugin Backend] Initializing...');

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const providers = new Map<string, ClickHouseProvider | CSVProvider>();

  // Initialize storage
  let storage: DataPluginStorage | null = null;
  if (mergedConfig.storage) {
    try {
      storage = new DataPluginStorage();
      await storage.initialize(mergedConfig.storage);
      console.info('[DataPlugin Backend] Storage initialized');
    } catch (error) {
      console.error('[DataPlugin Backend] Failed to initialize storage:', error);
    }
  }

  // Initialize cache
  let cache: DataPluginCache | null = null;
  if (mergedConfig.cache) {
    try {
      cache = new DataPluginCache();
      await cache.initialize(mergedConfig.cache);
      console.info('[DataPlugin Backend] Cache initialized');
    } catch (error) {
      console.error('[DataPlugin Backend] Failed to initialize cache:', error);
    }
  }

  // Initialize providers
  if (mergedConfig.providers?.clickhouse?.enabled) {
    try {
      const clickhouse = new ClickHouseProvider();
      await clickhouse.initialize({
        enabled: true,
        baseUrl: mergedConfig.providers.clickhouse.baseUrl,
        apiKey: mergedConfig.providers.clickhouse.apiKey,
        apiSecret: mergedConfig.providers.clickhouse.apiSecret,
      });
      providers.set('clickhouse', clickhouse);
      console.info('[DataPlugin Backend] ClickHouse provider initialized');
    } catch (error) {
      console.error('[DataPlugin Backend] Failed to initialize ClickHouse:', error);
    }
  }

  if (mergedConfig.providers?.csv?.enabled) {
    try {
      const csv = new CSVProvider();
      await csv.initialize({ enabled: true });
      providers.set('csv', csv);
      console.info('[DataPlugin Backend] CSV provider initialized');
    } catch (error) {
      console.error('[DataPlugin Backend] Failed to initialize CSV provider:', error);
    }
  }

  // Create context
  backendContext = {
    storage: storage!,
    cache: cache!,
    providers,
    activeProviderId: mergedConfig.defaultProvider || 'clickhouse',
  };

  // Register IPC handlers
  registerDataIPCHandlers(ipcMain, backendContext);

  initialized = true;
  console.info('[DataPlugin Backend] Initialized successfully');
}

/**
 * Shutdown the Data Source Nexus backend
 */
export async function shutdownDataBackend(ipcMain: IpcMain): Promise<void> {
  if (!initialized || !backendContext) {
    return;
  }

  console.info('[DataPlugin Backend] Shutting down...');

  // Unregister IPC handlers
  unregisterDataIPCHandlers(ipcMain);

  // Shutdown providers
  for (const provider of backendContext.providers.values()) {
    try {
      await (provider as any).shutdown?.();
    } catch (error) {
      console.error('[DataPlugin Backend] Error shutting down provider:', error);
    }
  }
  backendContext.providers.clear();

  // Shutdown cache
  if (backendContext.cache) {
    try {
      await backendContext.cache.shutdown();
    } catch (error) {
      console.error('[DataPlugin Backend] Error shutting down cache:', error);
    }
  }

  // Close storage
  if (backendContext.storage) {
    try {
      await backendContext.storage.close();
    } catch (error) {
      console.error('[DataPlugin Backend] Error closing storage:', error);
    }
  }

  backendContext = null;
  initialized = false;
  console.info('[DataPlugin Backend] Shutdown complete');
}

/**
 * Get the backend context (for internal use)
 */
export function getDataBackendContext(): DataBackendContext | null {
  return backendContext;
}

/**
 * Check if backend is initialized
 */
export function isDataBackendInitialized(): boolean {
  return initialized;
}

// =============================================================================
// Re-exports
// =============================================================================

export { DataPluginStorage } from './storage/sqlite';
export { DataPluginCache } from './storage/cache';
export { ClickHouseProvider } from './providers/clickhouse';
export { CSVProvider } from './providers/csv';
export { DATA_CHANNELS } from './ipc/handlers';
export type { DataBackendContext } from './ipc/handlers';

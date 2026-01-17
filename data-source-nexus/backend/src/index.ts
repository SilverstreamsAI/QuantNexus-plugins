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

// TICKET_097_6: Dynamic import to avoid build-time dependency on native addon
let SharedMemoryWriter: any = null;
try {
  const nativeModule = require('../native');
  SharedMemoryWriter = nativeModule.SharedMemoryWriter;
} catch (err) {
  console.warn('[DataPlugin Backend] Native SharedMemoryWriter not available:', (err as Error).message);
}

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
  sharedMemory?: {
    enabled: boolean;
    regionName?: string;
    regionSize?: number;
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
  sharedMemory: {
    enabled: true,
    regionName: 'quantnexus_ohlcv',
    regionSize: 128 * 1024 * 1024, // 128 MB
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
 * TICKET_127: Now returns DataBackendContext for Host Layer registry.
 *
 * This should be called from the Electron main process during app startup.
 */
export async function initializeDataBackend(
  ipcMain: IpcMain,
  config: DataBackendConfig = DEFAULT_CONFIG
): Promise<DataBackendContext> {
  if (initialized) {
    console.warn('[DataPlugin Backend] Already initialized');
    return backendContext!;
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

  // Initialize shared memory writer (TICKET_097_6, TICKET_128)
  let shmWriter: any | null = null;
  if (mergedConfig.sharedMemory?.enabled && SharedMemoryWriter) {
    try {
      shmWriter = new SharedMemoryWriter();
      const success = shmWriter.create(
        mergedConfig.sharedMemory.regionName || 'quantnexus_ohlcv',
        mergedConfig.sharedMemory.regionSize || 128 * 1024 * 1024
      );
      if (success) {
        console.info('[DataPlugin Backend] SharedMemory writer initialized:', mergedConfig.sharedMemory.regionName);
      } else {
        console.warn('[DataPlugin Backend] SharedMemory writer creation failed');
        shmWriter = null;
      }
    } catch (error) {
      console.error('[DataPlugin Backend] Failed to initialize SharedMemory:', error);
      shmWriter = null;
    }
  } else if (mergedConfig.sharedMemory?.enabled && !SharedMemoryWriter) {
    console.warn('[DataPlugin Backend] SharedMemory enabled but native addon not available');
  } else if (mergedConfig.sharedMemory?.enabled === false) {
    console.info('[DataPlugin Backend] SharedMemory deferred (TICKET_128: will enable after C++ Core ready)');
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
    shmWriter: shmWriter,  // TICKET_097_6: Add shared memory writer
  };

  // TICKET_127: DON'T register IPC handlers
  // Host Layer will proxy calls to exported functions
  // registerDataIPCHandlers(ipcMain, backendContext);

  initialized = true;
  console.info('[DataPlugin Backend] Initialized successfully (proxy mode)');

  // Return context for Host Layer registry
  return backendContext;
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

  // Close shared memory writer (TICKET_097_6)
  if (backendContext.shmWriter) {
    try {
      backendContext.shmWriter.close();
      console.info('[DataPlugin Backend] SharedMemory writer closed');
    } catch (error) {
      console.error('[DataPlugin Backend] Error closing SharedMemory:', error);
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
// TICKET_127: Exported Operations (for Host Layer proxy)
// =============================================================================

/**
 * Search symbols by query
 * Called by Host Layer data-handlers.ts
 */
export async function searchSymbols(query: string): Promise<any[]> {
  if (!backendContext) {
    throw new Error('[DataPlugin Backend] Not initialized');
  }

  // Check cache
  if (backendContext.cache) {
    const cached = backendContext.cache.getSearchResults(query);
    if (cached) {
      return cached;
    }
  }

  // Fetch from active provider
  const provider = backendContext.providers.get(backendContext.activeProviderId);
  if (!provider) {
    return [];
  }

  const results = await (provider as any).searchSymbols(query);

  // Cache results
  if (backendContext.cache && results.length > 0) {
    backendContext.cache.setSearchResults(query, results);
  }

  return results;
}

/**
 * Fetch historical OHLCV data
 */
export async function fetchHistoricalData(request: any): Promise<any> {
  if (!backendContext) {
    throw new Error('[DataPlugin Backend] Not initialized');
  }

  const { symbol, interval, start, end } = request;

  // Check cache first
  if (backendContext.cache && start && end) {
    const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
    const endTs = typeof end === 'string' ? new Date(end).getTime() : end;
    const cached = backendContext.cache.getOHLCV(symbol, interval, startTs, endTs);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }
  }

  // Check storage
  if (backendContext.storage && start && end) {
    const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
    const endTs = typeof end === 'string' ? new Date(end).getTime() : end;

    const hasData = await backendContext.storage.hasData(symbol, interval, startTs, endTs);
    if (hasData) {
      const result = await backendContext.storage.queryOHLCV({
        symbol,
        interval,
        start: startTs,
        end: endTs,
      });

      const series = {
        symbol,
        interval,
        data: result.data,
        start: startTs,
        end: endTs,
      };

      // Update cache
      if (backendContext.cache) {
        backendContext.cache.setOHLCV(series);
      }

      return { success: true, data: series };
    }
  }

  // Fetch from active provider
  const provider = backendContext.providers.get(backendContext.activeProviderId);
  if (!provider) {
    return {
      success: false,
      error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
    };
  }

  const response = await (provider as any).getHistoricalData(request);

  // Store and cache on success
  if (response.success && response.data) {
    if (backendContext.storage) {
      await backendContext.storage.storeOHLCV(response.data);
    }
    if (backendContext.cache) {
      backendContext.cache.setOHLCV(response.data);
    }
  }

  return response;
}

/**
 * Check data coverage for a symbol/interval/date range
 */
export async function checkCoverage(request: {
  symbol: string;
  interval: string;
  start: string | number;
  end: string | number;
}): Promise<any> {
  if (!backendContext || !backendContext.storage) {
    return {
      symbol: request.symbol,
      interval: request.interval,
      completeness: 0,
      totalBars: 0,
    };
  }

  const startTs = typeof request.start === 'string' ? new Date(request.start).getTime() : request.start;
  const endTs = typeof request.end === 'string' ? new Date(request.end).getTime() : request.end;

  // Cast interval to Interval type (validated by caller)
  const interval = request.interval as any;

  const hasData = await backendContext.storage.hasData(request.symbol, interval, startTs, endTs);

  if (hasData) {
    const result = await backendContext.storage.queryOHLCV({
      symbol: request.symbol,
      interval: interval,
      start: startTs,
      end: endTs,
    });

    return {
      symbol: request.symbol,
      interval: request.interval,
      startDate: new Date(startTs).toISOString(),
      endDate: new Date(endTs).toISOString(),
      totalBars: result.data.length,
      completeness: 1.0,
    };
  }

  return {
    symbol: request.symbol,
    interval: request.interval,
    startDate: new Date(startTs).toISOString(),
    endDate: new Date(endTs).toISOString(),
    totalBars: 0,
    completeness: 0,
    missingRanges: [{ start: new Date(startTs).toISOString(), end: new Date(endTs).toISOString() }],
  };
}

/**
 * Get provider status
 */
export async function getProviderStatus(providerId?: string): Promise<any> {
  if (!backendContext) {
    return { connected: false, error: 'Backend not initialized' };
  }

  const targetId = providerId || backendContext.activeProviderId;
  const provider = backendContext.providers.get(targetId);

  if (!provider) {
    return { connected: false, error: 'Provider not found' };
  }

  try {
    return await (provider as any).getStatus?.() || { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Extension Host Compatibility (TICKET_097)
// =============================================================================

/**
 * Plugin Context from Extension Host
 */
interface PluginContext {
  pluginId: string;
  pluginPath: string;
  log: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  storage: any;
  subscriptions: { dispose: () => void }[];
}

/**
 * Plugin API returned by activate
 */
interface PluginApi {
  searchSymbols?: (query: string) => Promise<any[]>;
  fetchHistoricalData?: (request: any) => Promise<any>;
  checkCoverage?: (request: any) => Promise<any>;
  getProviderStatus?: (providerId?: string) => Promise<any>;
}

/**
 * Extension Host activate function
 * Called when plugin is loaded by Extension Host
 */
export async function activate(context: PluginContext): Promise<PluginApi> {
  context.log.info('Data Source Nexus backend activating...');

  try {
    // Initialize backend (no IPC registration in Extension Host mode)
    await initializeDataBackend(null as any, {
      storage: {
        dbPath: 'data/market.db',
      },
      cache: {
        maxMemoryMB: 256,
      },
      sharedMemory: {
        enabled: false, // Will be enabled after C++ Core ready
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
    });

    context.log.info('Data Source Nexus backend activated successfully');

    // Return plugin API (exported functions)
    return {
      searchSymbols,
      fetchHistoricalData,
      checkCoverage,
      getProviderStatus,
    };
  } catch (error) {
    context.log.error('Failed to activate Data Source Nexus backend:', error);
    throw error;
  }
}

/**
 * Extension Host deactivate function
 * Called when plugin is unloaded
 */
export async function deactivate(): Promise<void> {
  console.info('[DataPlugin Backend] Deactivating...');
  await shutdownDataBackend(null as any);
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

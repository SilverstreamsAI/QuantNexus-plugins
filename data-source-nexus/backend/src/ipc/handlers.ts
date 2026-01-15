/**
 * Data Plugin IPC Handlers
 *
 * Registers IPC handlers for data operations in the Electron main process.
 *
 * @see TICKET_061 - Data Nexus Architecture Refactor
 */

import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { DataPluginStorage } from '../storage/sqlite';
import type { DataPluginCache } from '../storage/cache';
import type { ClickHouseProvider } from '../providers/clickhouse';
import type { CSVProvider } from '../providers/csv';
import type {
  DataRequest,
  DataResponse,
  OHLCVSeries,
  Quote,
  SymbolInfo,
} from '@shared/types';

// =============================================================================
// IPC Channel Constants
// =============================================================================

export const DATA_CHANNELS = {
  // Provider Management
  GET_PROVIDERS: 'data:getProviders',
  SET_ACTIVE_PROVIDER: 'data:setActiveProvider',
  GET_PROVIDER_STATUS: 'data:getProviderStatus',

  // Data Operations
  FETCH_HISTORICAL: 'data:fetchHistorical',
  GET_QUOTE: 'data:getQuote',
  GET_QUOTES: 'data:getQuotes',

  // Symbol Operations
  SEARCH_SYMBOLS: 'data:searchSymbols',
  GET_SYMBOL_INFO: 'data:getSymbolInfo',
  LIST_SYMBOLS: 'data:listSymbols',

  // Storage Operations
  GET_CACHED_SYMBOLS: 'data:getCachedSymbols',
  CLEAR_CACHE: 'data:clearCache',
  GET_STORAGE_STATS: 'data:getStorageStats',
  REFRESH: 'data:refresh',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface DataBackendContext {
  storage: DataPluginStorage;
  cache: DataPluginCache;
  providers: Map<string, ClickHouseProvider | CSVProvider>;
  activeProviderId: string;
  shmWriter: any | null;  // TICKET_097_6: Shared memory writer for zero-copy data transfer
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Write OHLCV data to shared memory (TICKET_097_6)
 */
function writeToSharedMemory(context: DataBackendContext, series: OHLCVSeries): void {
  if (!context.shmWriter) {
    return;
  }

  try {
    const candles = series.data.map(candle => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    context.shmWriter.writeCandles(series.symbol, series.interval, candles);
  } catch (error) {
    console.error('[DataPlugin Backend] Failed to write to shared memory:', error);
  }
}

// =============================================================================
// IPC Handler Registration
// =============================================================================

export function registerDataIPCHandlers(
  ipcMain: IpcMain,
  context: DataBackendContext
): void {
  console.info('[DataPlugin Backend] Registering IPC handlers...');

  // -------------------------------------------------------------------------
  // Provider Management
  // -------------------------------------------------------------------------

  ipcMain.handle(DATA_CHANNELS.GET_PROVIDERS, async () => {
    const result: Array<{
      id: string;
      name: string;
      status: 'connected' | 'disconnected' | 'error';
    }> = [];

    for (const [id, provider] of context.providers) {
      try {
        const status = await (provider as any).getStatus?.();
        result.push({
          id,
          name: (provider as any).getInfo?.()?.name || id,
          status: status?.connected ? 'connected' : 'disconnected',
        });
      } catch {
        result.push({ id, name: id, status: 'error' });
      }
    }

    return result;
  });

  ipcMain.handle(DATA_CHANNELS.SET_ACTIVE_PROVIDER, async (_event: IpcMainInvokeEvent, providerId: string) => {
    if (!context.providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    context.activeProviderId = providerId;
    return { success: true };
  });

  ipcMain.handle(DATA_CHANNELS.GET_PROVIDER_STATUS, async (_event: IpcMainInvokeEvent, providerId: string) => {
    const provider = context.providers.get(providerId);
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
  });

  // -------------------------------------------------------------------------
  // Data Operations
  // -------------------------------------------------------------------------

  ipcMain.handle(DATA_CHANNELS.FETCH_HISTORICAL, async (_event: IpcMainInvokeEvent, request: DataRequest) => {
    const { symbol, interval, start, end } = request;

    // Check cache first
    if (context.cache && start && end) {
      const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
      const endTs = typeof end === 'string' ? new Date(end).getTime() : end;
      const cached = context.cache.getOHLCV(symbol, interval, startTs, endTs);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }
    }

    // Check storage
    if (context.storage && start && end) {
      const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
      const endTs = typeof end === 'string' ? new Date(end).getTime() : end;

      const hasData = await context.storage.hasData(symbol, interval, startTs, endTs);
      if (hasData) {
        const result = await context.storage.queryOHLCV({
          symbol,
          interval,
          start: startTs,
          end: endTs,
        });

        const series: OHLCVSeries = {
          symbol,
          interval,
          data: result.data,
          start: startTs,
          end: endTs,
        };

        // Update cache
        if (context.cache) {
          context.cache.setOHLCV(series);
        }

        // Write to shared memory (TICKET_097_6)
        writeToSharedMemory(context, series);

        return { success: true, data: series };
      }
    }

    // Fetch from active provider
    const provider = context.providers.get(context.activeProviderId);
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await (provider as any).getHistoricalData(request);

    // Store and cache on success
    if (response.success && response.data) {
      if (context.storage) {
        await context.storage.storeOHLCV(response.data);
      }
      if (context.cache) {
        context.cache.setOHLCV(response.data);
      }
      // Write to shared memory (TICKET_097_6)
      writeToSharedMemory(context, response.data);
    }

    return response;
  });

  ipcMain.handle(DATA_CHANNELS.GET_QUOTE, async (_event: IpcMainInvokeEvent, symbol: string) => {
    // Check cache
    if (context.cache) {
      const cached = context.cache.getQuote(symbol);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }
    }

    // Fetch from provider
    const provider = context.providers.get(context.activeProviderId);
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await (provider as any).getQuote(symbol);

    // Cache on success
    if (response.success && response.data && context.cache) {
      context.cache.setQuote(symbol, response.data);
    }

    return response;
  });

  ipcMain.handle(DATA_CHANNELS.GET_QUOTES, async (_event: IpcMainInvokeEvent, symbols: string[]) => {
    const results = new Map<string, DataResponse<Quote>>();
    const missing: string[] = [];

    // Check cache first
    if (context.cache) {
      const cached = context.cache.getQuotes(symbols);
      for (const symbol of symbols) {
        const quote = cached.get(symbol);
        if (quote) {
          results.set(symbol, { success: true, data: quote, cached: true });
        } else {
          missing.push(symbol);
        }
      }
    } else {
      missing.push(...symbols);
    }

    // Fetch missing from provider
    if (missing.length > 0) {
      const provider = context.providers.get(context.activeProviderId);
      if (provider) {
        const fetched = await (provider as any).getQuotes(missing);
        for (const [symbol, response] of fetched) {
          results.set(symbol, response);
          if (response.success && response.data && context.cache) {
            context.cache.setQuote(symbol, response.data);
          }
        }
      }
    }

    // Convert Map to object for IPC serialization
    return Object.fromEntries(results);
  });

  // -------------------------------------------------------------------------
  // Symbol Operations
  // -------------------------------------------------------------------------

  ipcMain.handle(DATA_CHANNELS.SEARCH_SYMBOLS, async (_event: IpcMainInvokeEvent, query: string) => {
    // Check cache
    if (context.cache) {
      const cached = context.cache.getSearchResults(query);
      if (cached) {
        return cached;
      }
    }

    // Fetch from provider
    const provider = context.providers.get(context.activeProviderId);
    if (!provider) {
      return [];
    }

    const results = await (provider as any).searchSymbols(query);

    // Cache results
    if (context.cache && results.length > 0) {
      context.cache.setSearchResults(query, results);
    }

    return results;
  });

  ipcMain.handle(DATA_CHANNELS.GET_SYMBOL_INFO, async (_event: IpcMainInvokeEvent, symbol: string) => {
    // Check cache
    if (context.cache) {
      const cached = context.cache.getSymbolInfo(symbol);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }
    }

    // Check storage
    if (context.storage) {
      const stored = await context.storage.getSymbolInfo(symbol);
      if (stored) {
        if (context.cache) {
          context.cache.setSymbolInfo(stored);
        }
        return { success: true, data: stored };
      }
    }

    // Fetch from provider
    const provider = context.providers.get(context.activeProviderId);
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await (provider as any).getSymbolInfo(symbol);

    // Store and cache
    if (response.success && response.data) {
      if (context.storage) {
        await context.storage.storeSymbolInfo(response.data);
      }
      if (context.cache) {
        context.cache.setSymbolInfo(response.data);
      }
    }

    return response;
  });

  ipcMain.handle(DATA_CHANNELS.LIST_SYMBOLS, async () => {
    const provider = context.providers.get(context.activeProviderId);
    if (!provider) {
      return [];
    }
    return (provider as any).listSymbols?.() || [];
  });

  // -------------------------------------------------------------------------
  // Storage Operations
  // -------------------------------------------------------------------------

  ipcMain.handle(DATA_CHANNELS.GET_CACHED_SYMBOLS, async () => {
    if (!context.storage) {
      return [];
    }

    const symbols = await context.storage.listStoredSymbols();
    return symbols.map(symbol => ({
      symbol,
      intervals: ['1d'], // TODO: Get actual intervals from storage
    }));
  });

  ipcMain.handle(DATA_CHANNELS.CLEAR_CACHE, async () => {
    if (context.cache) {
      context.cache.clear();
    }
    return { success: true };
  });

  ipcMain.handle(DATA_CHANNELS.GET_STORAGE_STATS, async () => {
    const cacheStats = context.cache?.getStats();
    const storageStats = context.storage ? await context.storage.getStats() : null;

    return {
      cache: cacheStats,
      storage: storageStats,
    };
  });

  ipcMain.handle(DATA_CHANNELS.REFRESH, async () => {
    // Clear cache
    if (context.cache) {
      context.cache.invalidateQuotes();
    }
    return { success: true };
  });

  console.info('[DataPlugin Backend] IPC handlers registered');
}

// =============================================================================
// Cleanup
// =============================================================================

export function unregisterDataIPCHandlers(ipcMain: IpcMain): void {
  for (const channel of Object.values(DATA_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
  console.info('[DataPlugin Backend] IPC handlers unregistered');
}

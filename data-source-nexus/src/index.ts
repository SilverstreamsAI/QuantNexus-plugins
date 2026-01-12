/**
 * Data Plugin - QuantNexus Market Data Provider
 *
 * TICKET_097_4: Bridge Integration
 * - DataChannel for zero-copy tick data
 * - Bridge.registerDataFeed() for Core registry
 *
 * Provides market data from multiple sources with caching and local storage.
 */

import type {
  PluginModule,
  PluginContext,
  PluginApi,
  DataSourcePlugin,
  DataSourcePluginConfig,
} from '@shared/types';
import type {
  DataProvider,
  ProviderConfig,
  DataProviderManager,
} from '@shared/types';
import type {
  DataStorage,
  StorageConfig,
} from '@shared/types';
import type {
  DataCache,
  CacheConfig,
} from '@shared/types';
import type {
  OHLCVSeries,
  Quote,
  SymbolInfo,
  DataRequest,
  DataResponse,
  DataEvent,
  DataEventType,
  SubscriptionHandle,
  Interval,
} from '@shared/types';

// TICKET_097_5: Bridge Integration via contributions API
// Bridge is loaded by Extension Host, accessed via globalThis.nexus.contributions
type TickData = { timestamp: number; price: number; volume: number };
type TickCallback = (ticks: TickData[]) => void;

interface ContributionsApi {
  registerDataFeed?: (reg: { id: string; pluginId: string; adapter: string; config: string }) => boolean;
  unregisterDataFeed?: (id: string) => boolean;
  getDataFeeds?: () => Array<{ id: string; adapter: string }>;
}

import { DataPluginStorage } from './storage/sqlite';
import { DataPluginCache } from './storage/cache';
import { ClickHouseProvider } from './providers/clickhouse';
import { CSVProvider } from './providers/csv';

// =============================================================================
// Data Plugin Implementation
// =============================================================================

class DataPlugin implements DataSourcePlugin {
  private context: PluginContext;
  private config: DataSourcePluginConfig;
  private providers: Map<string, DataProvider> = new Map();
  private activeProviderId: string | null = null;
  private storage: DataPluginStorage | null = null;
  private cache: DataPluginCache | null = null;
  private subscriptions: Map<string, SubscriptionHandle> = new Map();

  // TICKET_097_5: Bridge Integration via contributions API
  private contributions: ContributionsApi | null = null;
  private tickSubscriptions: Map<string, TickCallback> = new Map();

  constructor(context: PluginContext, config: DataSourcePluginConfig) {
    this.context = context;
    this.config = config;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async activate(): Promise<void> {
    this.context.log.info('Data plugin activating...');

    // =========================================================================
    // TICKET_097_5: Access Bridge via contributions API
    // =========================================================================
    try {
      const nexus = (globalThis as { nexus?: { contributions?: ContributionsApi } }).nexus;
      this.contributions = nexus?.contributions || null;

      if (this.contributions?.registerDataFeed) {
        // Register data feeds to Core registry
        this.contributions.registerDataFeed({
          id: 'nexus.local-data',
          pluginId: 'com.quantnexus.data-source-nexus',
          adapter: 'sqlite',
          config: JSON.stringify({ dbPath: this.config.storage?.dbPath || 'data/market.db' }),
        });

        this.contributions.registerDataFeed({
          id: 'nexus.clickhouse',
          pluginId: 'com.quantnexus.data-source-nexus',
          adapter: 'clickhouse',
          config: JSON.stringify({ baseUrl: this.config.providers?.clickhouse?.baseUrl }),
        });

        this.context.log.info('Bridge contributions API available, data feeds registered');
      } else {
        this.context.log.warn('Bridge contributions API not available (IPC fallback mode)');
      }
    } catch (err) {
      this.context.log.warn(`Bridge access failed (fallback mode): ${err}`);
    }

    // Initialize storage
    if (this.config.storage) {
      this.storage = new DataPluginStorage();
      await this.storage.initialize(this.config.storage);
      this.context.log.info('Storage initialized');
    }

    // Initialize cache
    if (this.config.cache) {
      this.cache = new DataPluginCache();
      await this.cache.initialize(this.config.cache);
      this.context.log.info('Cache initialized');
    }

    // Initialize providers
    await this.initializeProviders();

    // Set default provider
    if (this.config.defaultProvider && this.providers.has(this.config.defaultProvider)) {
      this.activeProviderId = this.config.defaultProvider;
    } else if (this.providers.size > 0) {
      this.activeProviderId = this.providers.keys().next().value ?? null;
    }

    // Register commands
    this.registerCommands();

    this.context.log.info('Data plugin activated');
  }

  async deactivate(): Promise<void> {
    this.context.log.info('Data plugin deactivating...');

    // =========================================================================
    // TICKET_097_5: Cleanup Bridge resources via contributions API
    // =========================================================================
    this.tickSubscriptions.clear();

    if (this.contributions?.unregisterDataFeed) {
      this.contributions.unregisterDataFeed('nexus.local-data');
      this.contributions.unregisterDataFeed('nexus.clickhouse');
    }
    this.contributions = null;

    // Unsubscribe all
    await this.unsubscribeAll();

    // Shutdown providers
    for (const provider of this.providers.values()) {
      await provider.shutdown();
    }
    this.providers.clear();

    // Close storage
    if (this.storage) {
      await this.storage.close();
      this.storage = null;
    }

    // Shutdown cache
    if (this.cache) {
      await this.cache.shutdown();
      this.cache = null;
    }

    this.context.log.info('Data plugin deactivated');
  }

  // ===========================================================================
  // Provider Management
  // ===========================================================================

  private async initializeProviders(): Promise<void> {
    const providerConfigs = this.config.providers || {};

    // ClickHouse (primary data source)
    if (providerConfigs.clickhouse?.enabled !== false) {
      const clickhouse = new ClickHouseProvider();
      await clickhouse.initialize(providerConfigs.clickhouse || {
        enabled: true,
        baseUrl: 'https://clickhouse.silvonastream.com',
      });
      this.providers.set('clickhouse', clickhouse);
      this.context.log.info('ClickHouse provider initialized');
    }

    // CSV Provider (local files)
    const csv = new CSVProvider();
    await csv.initialize(providerConfigs.csv || { enabled: true });
    this.providers.set('csv', csv);
    this.context.log.info('CSV provider initialized');
  }

  getProviders(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProvider(): DataProvider | undefined {
    if (!this.activeProviderId) return undefined;
    return this.providers.get(this.activeProviderId);
  }

  async setActiveProvider(providerId: string): Promise<void> {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    this.activeProviderId = providerId;
    this.context.log.info(`Active provider set to: ${providerId}`);
  }

  async configureProvider(providerId: string, config: ProviderConfig): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    await provider.shutdown();
    await provider.initialize(config);
    this.context.log.info(`Provider reconfigured: ${providerId}`);
  }

  // ===========================================================================
  // Data Access
  // ===========================================================================

  async fetchHistoricalData(request: DataRequest): Promise<DataResponse<OHLCVSeries>> {
    const { symbol, interval, start, end } = request;

    // Check cache first
    if (this.cache && start && end) {
      const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
      const endTs = typeof end === 'string' ? new Date(end).getTime() : end;
      const cached = this.cache.getOHLCV(symbol, interval, startTs, endTs);
      if (cached) {
        this.context.log.debug(`Cache hit for ${symbol} ${interval}`);
        return { success: true, data: cached, cached: true };
      }
    }

    // Check storage
    if (this.storage && start && end) {
      const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
      const endTs = typeof end === 'string' ? new Date(end).getTime() : end;

      const hasData = await this.storage.hasData(symbol, interval, startTs, endTs);
      if (hasData) {
        const result = await this.storage.queryOHLCV({
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
        if (this.cache) {
          this.cache.setOHLCV(series);
        }

        this.context.log.debug(`Storage hit for ${symbol} ${interval}`);
        return { success: true, data: series };
      }
    }

    // Fetch from provider
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await provider.getHistoricalData(request);

    // Store and cache on success
    if (response.success && response.data) {
      if (this.storage) {
        await this.storage.storeOHLCV(response.data);
      }
      if (this.cache) {
        this.cache.setOHLCV(response.data);
      }
    }

    return response;
  }

  async getQuote(symbol: string): Promise<DataResponse<Quote>> {
    // Check cache
    if (this.cache) {
      const cached = this.cache.getQuote(symbol);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }
    }

    // Fetch from provider
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await provider.getQuote(symbol);

    // Cache on success
    if (response.success && response.data && this.cache) {
      this.cache.setQuote(symbol, response.data);
    }

    return response;
  }

  async getQuotes(symbols: string[]): Promise<Map<string, DataResponse<Quote>>> {
    const results = new Map<string, DataResponse<Quote>>();
    const missing: string[] = [];

    // Check cache first
    if (this.cache) {
      const cached = this.cache.getQuotes(symbols);
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
      const provider = this.getActiveProvider();
      if (provider) {
        const fetched = await provider.getQuotes(missing);
        for (const [symbol, response] of fetched) {
          results.set(symbol, response);
          if (response.success && response.data && this.cache) {
            this.cache.setQuote(symbol, response.data);
          }
        }
      }
    }

    return results;
  }

  async subscribe(
    symbol: string,
    types: DataEventType[],
    onData: (event: DataEvent) => void
  ): Promise<SubscriptionHandle> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active provider');
    }

    const handle = await provider.subscribe(symbol, types, (event) => {
      // Update cache on new data
      if (this.cache) {
        if (event.type === 'quote' && 'bid' in event.data) {
          this.cache.setQuote(symbol, event.data as Quote);
        } else if (event.type === 'bar' && 'open' in (event.data as any)) {
          const bar = event.data as any;
          this.cache.appendBar(symbol, (bar as any).interval || '1d', bar);
        }
      }

      onData(event);
    });

    this.subscriptions.set(handle.id, handle);
    return handle;
  }

  async unsubscribeAll(): Promise<void> {
    for (const handle of this.subscriptions.values()) {
      handle.unsubscribe();
    }
    this.subscriptions.clear();

    const provider = this.getActiveProvider();
    if (provider) {
      await provider.unsubscribeAll();
    }
  }

  // ===========================================================================
  // TICKET_097_5: Tick Data Subscription (placeholder for future DataChannel)
  // ===========================================================================

  /**
   * Subscribe to tick data
   * Note: Zero-copy DataChannel requires Extension Host environment.
   * This is a placeholder for IPC-based tick subscription.
   */
  subscribeToTicks(symbol: string, callback: TickCallback): () => void {
    this.tickSubscriptions.set(symbol, callback);
    this.context.log.info(`Subscribed to tick data: ${symbol} (IPC mode)`);

    return () => {
      this.tickSubscriptions.delete(symbol);
      this.context.log.info(`Unsubscribed from tick data: ${symbol}`);
    };
  }

  /**
   * Get registered data feeds from Bridge
   */
  getRegisteredDataFeeds() {
    return this.contributions?.getDataFeeds?.() || [];
  }

  /**
   * Check if contributions API is available
   */
  hasContributionsApi(): boolean {
    return this.contributions !== null;
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    // Check cache
    if (this.cache) {
      const cached = this.cache.getSearchResults(query);
      if (cached) {
        return cached;
      }
    }

    const provider = this.getActiveProvider();
    if (!provider) {
      return [];
    }

    const results = await provider.searchSymbols(query);

    // Cache results
    if (this.cache && results.length > 0) {
      this.cache.setSearchResults(query, results);
    }

    return results;
  }

  async getSymbolInfo(symbol: string): Promise<DataResponse<SymbolInfo>> {
    // Check cache
    if (this.cache) {
      const cached = this.cache.getSymbolInfo(symbol);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }
    }

    // Check storage
    if (this.storage) {
      const stored = await this.storage.getSymbolInfo(symbol);
      if (stored) {
        if (this.cache) {
          this.cache.setSymbolInfo(stored);
        }
        return { success: true, data: stored };
      }
    }

    // Fetch from provider
    const provider = this.getActiveProvider();
    if (!provider) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'No active provider' },
      };
    }

    const response = await provider.getSymbolInfo(symbol);

    // Store and cache
    if (response.success && response.data) {
      if (this.storage) {
        await this.storage.storeSymbolInfo(response.data);
      }
      if (this.cache) {
        this.cache.setSymbolInfo(response.data);
      }
    }

    return response;
  }

  async listSymbols(): Promise<SymbolInfo[]> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return [];
    }
    return provider.listSymbols();
  }

  // ===========================================================================
  // Storage/Cache Access
  // ===========================================================================

  getStorage(): DataStorage | undefined {
    return this.storage || undefined;
  }

  getCache(): DataCache | undefined {
    return this.cache || undefined;
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  getSupportedIntervals(symbol: string): Interval[] {
    const provider = this.getActiveProvider();
    if (!provider) {
      return ['1d'];
    }
    return provider.getSupportedIntervals(symbol);
  }

  async isSymbolSupported(symbol: string): Promise<boolean> {
    const provider = this.getActiveProvider();
    if (!provider) {
      return false;
    }
    return provider.validateSymbol(symbol);
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private registerCommands(): void {
    this.context.commands.register('data.refresh', async () => {
      this.context.log.info('Refreshing data...');
      if (this.cache) {
        this.cache.clear();
      }
      this.context.ui.showNotification('Data refreshed', 'success');
    });

    this.context.commands.register('data.clearCache', async () => {
      if (this.cache) {
        this.cache.clear();
        this.context.ui.showNotification('Cache cleared', 'success');
      }
    });

    this.context.commands.register('data.importCSV', async (filePath: any) => {
      const csvProvider = this.providers.get('csv') as any;
      if (!csvProvider) {
        throw new Error('CSV provider not available');
      }
      // Implementation will be in CSV provider
      this.context.log.info(`Importing CSV: ${filePath}`);
    });

    this.context.commands.register('data.exportCSV', async (
      symbol: any,
      interval: any,
      filePath: any
    ) => {
      if (!this.storage) {
        throw new Error('Storage not available');
      }
      await this.storage.exportToCSV(symbol, interval, filePath);
      this.context.ui.showNotification('Data exported', 'success');
    });
  }
}

// =============================================================================
// Plugin Module Export
// =============================================================================

const plugin: PluginModule = {
  async activate(context: PluginContext): Promise<PluginApi> {
    // Get config from context storage or use defaults
    // ClickHouse access via Cloudflare Tunnel
    const config: DataSourcePluginConfig = {
      providers: {
        clickhouse: {
          enabled: true,
          // External access via Cloudflare Tunnel (HTTPS)
          baseUrl: 'https://clickhouse.silvonastream.com',
          // apiKey = username, apiSecret = password
        },
        csv: { enabled: true },
      },
      defaultProvider: 'clickhouse',
      storage: {
        dbPath: 'data/market.db',
      },
      cache: {
        maxMemoryMB: 256,
        defaultTTL: 300000,
      },
    };

    const dataPlugin = new DataPlugin(context, config);
    await dataPlugin.activate();

    return dataPlugin;
  },

  async deactivate(): Promise<void> {
    // Cleanup handled by DataPlugin.deactivate()
  },
};

export default plugin;
export { DataPlugin };

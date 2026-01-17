/**
 * ClickHouse Data Provider
 *
 * Data provider using ClickHouse database for market data.
 * Connection: clickhouse.silvonastream.com
 */

import { createClient, ClickHouseClient } from '@clickhouse/client';
import type {
  DataProvider,
  ProviderInfo,
  ProviderStatus,
  ProviderConfig,
  ProviderCapabilities,
  SymbolSearchOptions,
  ListSymbolsOptions,
  SubscribeOptions,
} from '@shared/types';
import type {
  SymbolInfo,
  OHLCV,
  OHLCVSeries,
  Quote,
  DataRequest,
  DataResponse,
  DataEvent,
  DataEventType,
  SubscriptionHandle,
  Interval,
  AssetType,
  Exchange,
} from '@shared/types';

// =============================================================================
// ClickHouse Configuration
// =============================================================================

interface ClickHouseConfig extends ProviderConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  // Table names
  ohlcvTable?: string;
  symbolTable?: string;
}

// =============================================================================
// ClickHouse Response Types
// =============================================================================

interface CHOHLCVRow {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval?: string;
}

interface CHSymbolRow {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
  sector?: string;
  industry?: string;
}

interface CHQuoteRow {
  symbol: string;
  timestamp: number;
  bid: number;
  bid_size: number;
  ask: number;
  ask_size: number;
  last: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

// =============================================================================
// Interval Mapping
// =============================================================================

const SUPPORTED_INTERVALS: Interval[] = [
  '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M',
];

// =============================================================================
// ClickHouseProvider Implementation
// =============================================================================

export class ClickHouseProvider implements DataProvider {
  private config: ClickHouseConfig | null = null;
  private client: ClickHouseClient | null = null;
  private ready = false;
  private subscriptions: Map<string, { timer: ReturnType<typeof setInterval>; callback: (event: DataEvent) => void }> = new Map();

  // Default configuration
  // External access via Cloudflare Tunnel (HTTPS on port 443)
  // Internal access: 111.220.88.138:19999 (TCP native)
  private defaultHost = 'clickhouse.silvonastream.com';
  private defaultDatabase = 'default';
  private defaultUser = 'webss';
  private ohlcvTable = 'alpha_stock_data';
  private symbolTable = 'symbols';

  // ===========================================================================
  // Metadata
  // ===========================================================================

  getInfo(): ProviderInfo {
    return {
      id: 'clickhouse',
      name: 'ClickHouse Market Data',
      description: 'Market data from ClickHouse database',
      website: 'https://clickhouse.com',
      requiresAuth: true,
      authType: 'apiKey',
      free: false,
      capabilities: this.getCapabilities(),
    };
  }

  private getCapabilities(): ProviderCapabilities {
    return {
      historicalOHLCV: true,
      realtimeQuotes: true,
      realtimeTrades: false,
      orderBook: false,
      intervals: SUPPORTED_INTERVALS,
      assetTypes: ['stock', 'etf', 'index', 'forex', 'crypto', 'futures'],
      exchanges: ['NYSE', 'NASDAQ', 'SSE', 'SZSE', 'BINANCE', 'OTHER'],
      adjustedPrices: true,
      extendedHours: true,
      symbolSearch: true,
      fundamentals: false,
      maxBarsPerRequest: 100000,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const start = Date.now();
      await this.ping();
      const latency = Date.now() - start;

      return {
        connected: true,
        authenticated: true,
        latency,
      };
    } catch (error) {
      return {
        connected: false,
        authenticated: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config as ClickHouseConfig;

    // Build connection URL
    // External: https://clickhouse.silvonastream.com (via Cloudflare Tunnel, port 443)
    // Internal: http://111.220.88.138:8123 (direct HTTP interface)
    // Note: @clickhouse/client uses HTTP protocol, Cloudflare Tunnel handles HTTPS termination
    const host = this.config.baseUrl || `https://${this.defaultHost}`;
    const database = (config as ClickHouseConfig).database || this.defaultDatabase;

    // Configure table names if provided
    if ((config as ClickHouseConfig).ohlcvTable) {
      this.ohlcvTable = (config as ClickHouseConfig).ohlcvTable!;
    }
    if ((config as ClickHouseConfig).symbolTable) {
      this.symbolTable = (config as ClickHouseConfig).symbolTable!;
    }

    // Create ClickHouse client
    // Note: @clickhouse/client uses HTTP protocol
    // For native TCP (port 19999), use Python clickhouse-driver
    this.client = createClient({
      host,
      database,
      username: config.apiKey || this.defaultUser,
      password: config.apiSecret || '',
      request_timeout: config.timeout || 30000,
      compression: {
        request: true,
        response: true,
      },
    });

    // Test connection
    try {
      await this.ping();
      this.ready = true;
    } catch (error) {
      this.ready = false;
      throw new Error(`ClickHouse connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async shutdown(): Promise<void> {
    await this.unsubscribeAll();

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.ready = false;
    this.config = null;
  }

  isReady(): boolean {
    return this.ready && this.client !== null;
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  async searchSymbols(query: string, options?: SymbolSearchOptions): Promise<SymbolInfo[]> {
    if (!this.client) {
      return [];
    }

    try {
      const limit = options?.limit || 20;
      const typeFilter = options?.type ? `AND type = '${options.type}'` : '';
      const exchangeFilter = options?.exchange ? `AND exchange = '${options.exchange}'` : '';

      const sql = `
        SELECT symbol, name, type, exchange, currency, sector, industry
        FROM ${this.symbolTable}
        WHERE (symbol ILIKE '%${query}%' OR name ILIKE '%${query}%')
        ${typeFilter}
        ${exchangeFilter}
        LIMIT ${limit}
      `;

      const result = await this.client.query({
        query: sql,
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHSymbolRow>();

      return rows.map(row => this.mapRowToSymbolInfo(row));
    } catch (error) {
      console.error('[ClickHouse] searchSymbols failed:', error);
      console.error('[ClickHouse] Client initialized:', !!this.client, 'Ready:', this.ready);
      return [];
    }
  }

  async getSymbolInfo(symbol: string): Promise<DataResponse<SymbolInfo>> {
    if (!this.client) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'Client not initialized' },
      };
    }

    try {
      const sql = `
        SELECT symbol, name, type, exchange, currency, sector, industry
        FROM ${this.symbolTable}
        WHERE symbol = {symbol:String}
        LIMIT 1
      `;

      const result = await this.client.query({
        query: sql,
        query_params: { symbol },
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHSymbolRow>();

      if (rows.length === 0) {
        return {
          success: false,
          error: { code: 'SYMBOL_NOT_FOUND', message: `Symbol not found: ${symbol}` },
        };
      }

      return {
        success: true,
        data: this.mapRowToSymbolInfo(rows[0]),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async listSymbols(options?: ListSymbolsOptions): Promise<SymbolInfo[]> {
    if (!this.client) {
      return [];
    }

    try {
      const limit = options?.limit || 100;
      const typeFilter = options?.type ? `WHERE type = '${options.type}'` : '';
      const exchangeFilter = options?.exchange
        ? (typeFilter ? `AND exchange = '${options.exchange}'` : `WHERE exchange = '${options.exchange}'`)
        : '';

      const sql = `
        SELECT symbol, name, type, exchange, currency, sector, industry
        FROM ${this.symbolTable}
        ${typeFilter}
        ${exchangeFilter}
        ORDER BY symbol
        LIMIT ${limit}
      `;

      const result = await this.client.query({
        query: sql,
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHSymbolRow>();

      return rows.map(row => this.mapRowToSymbolInfo(row));
    } catch (error) {
      console.error('ClickHouse listSymbols error:', error);
      return [];
    }
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    const response = await this.getSymbolInfo(symbol);
    return response.success;
  }

  // ===========================================================================
  // Historical Data
  // ===========================================================================

  async getHistoricalData(request: DataRequest): Promise<DataResponse<OHLCVSeries>> {
    if (!this.client) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'Client not initialized' },
      };
    }

    try {
      const { symbol, interval, start, end, limit } = request;

      // Calculate time range
      const endTs = end
        ? (typeof end === 'string' ? new Date(end).getTime() : end)
        : Date.now();
      const startTs = start
        ? (typeof start === 'string' ? new Date(start).getTime() : start)
        : endTs - 365 * 24 * 60 * 60 * 1000; // Default 1 year

      // Convert to seconds for ClickHouse (timestamps stored as Unix seconds)
      const startSec = Math.floor(startTs / 1000);
      const endSec = Math.floor(endTs / 1000);

      const limitClause = limit ? `LIMIT ${limit}` : '';

      // alpha_stock_data table uses 'date' column, not 'timestamp'
      // Schema: symbol, date, open, high, low, close, volume
      const sql = `
        SELECT
          symbol,
          toUnixTimestamp(date) * 1000 as timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${this.ohlcvTable}
        WHERE symbol = {symbol:String}
          AND date >= toDateTime({startSec:UInt32})
          AND date <= toDateTime({endSec:UInt32})
        ORDER BY date ASC
        ${limitClause}
      `;

      const result = await this.client.query({
        query: sql,
        query_params: {
          symbol,
          startSec,
          endSec,
        },
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHOHLCVRow>();

      if (rows.length === 0) {
        return {
          success: false,
          error: { code: 'NO_DATA', message: 'No data returned' },
        };
      }

      const bars: OHLCV[] = rows.map(row => ({
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }));

      const series: OHLCVSeries = {
        symbol,
        interval,
        data: bars,
        start: bars[0].timestamp,
        end: bars[bars.length - 1].timestamp,
        adjusted: request.adjusted !== false,
        source: 'clickhouse',
        fetchedAt: Date.now(),
      };

      return { success: true, data: series };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getHistoricalDataBatch(
    symbols: string[],
    request: Omit<DataRequest, 'symbol'>
  ): Promise<Map<string, DataResponse<OHLCVSeries>>> {
    const results = new Map<string, DataResponse<OHLCVSeries>>();

    // Fetch in parallel with batched query
    const promises = symbols.map(symbol =>
      this.getHistoricalData({ ...request, symbol })
        .then(response => ({ symbol, response }))
    );

    const resolved = await Promise.all(promises);

    for (const { symbol, response } of resolved) {
      results.set(symbol, response);
    }

    return results;
  }

  // ===========================================================================
  // Real-time Data
  // ===========================================================================

  async getQuote(symbol: string): Promise<DataResponse<Quote>> {
    if (!this.client) {
      return {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'Client not initialized' },
      };
    }

    try {
      // Get the latest OHLCV bar as a quote proxy
      const sql = `
        SELECT
          symbol,
          toUnixTimestamp(date) * 1000 as timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${this.ohlcvTable}
        WHERE symbol = {symbol:String}
        ORDER BY date DESC
        LIMIT 1
      `;

      const result = await this.client.query({
        query: sql,
        query_params: { symbol },
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHOHLCVRow>();

      if (rows.length === 0) {
        return {
          success: false,
          error: { code: 'SYMBOL_NOT_FOUND', message: `No data for symbol: ${symbol}` },
        };
      }

      const row = rows[0];
      const quote: Quote = {
        symbol,
        timestamp: row.timestamp,
        bid: row.close * 0.9999, // Approximate bid
        bidSize: 100,
        ask: row.close * 1.0001, // Approximate ask
        askSize: 100,
        last: row.close,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      };

      return { success: true, data: quote };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  async getQuotes(symbols: string[]): Promise<Map<string, DataResponse<Quote>>> {
    const results = new Map<string, DataResponse<Quote>>();

    if (!this.client) {
      for (const symbol of symbols) {
        results.set(symbol, {
          success: false,
          error: { code: 'PROVIDER_ERROR', message: 'Client not initialized' },
        });
      }
      return results;
    }

    try {
      // Batch query for latest quotes
      const symbolList = symbols.map(s => `'${s}'`).join(',');
      const sql = `
        SELECT
          symbol,
          toUnixTimestamp(date) * 1000 as timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM ${this.ohlcvTable}
        WHERE symbol IN (${symbolList})
        ORDER BY symbol, date DESC
        LIMIT 1 BY symbol
      `;

      const result = await this.client.query({
        query: sql,
        format: 'JSONEachRow',
      });

      const rows = await result.json<CHOHLCVRow>();

      // Map results
      const rowMap = new Map<string, CHOHLCVRow>();
      for (const row of rows) {
        rowMap.set(row.symbol, row);
      }

      for (const symbol of symbols) {
        const row = rowMap.get(symbol);
        if (row) {
          results.set(symbol, {
            success: true,
            data: {
              symbol,
              timestamp: row.timestamp,
              bid: row.close * 0.9999,
              bidSize: 100,
              ask: row.close * 1.0001,
              askSize: 100,
              last: row.close,
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            },
          });
        } else {
          results.set(symbol, {
            success: false,
            error: { code: 'SYMBOL_NOT_FOUND', message: `Symbol not found: ${symbol}` },
          });
        }
      }
    } catch (error) {
      for (const symbol of symbols) {
        results.set(symbol, {
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    return results;
  }

  async subscribe(
    symbol: string,
    types: DataEventType[],
    onData: (event: DataEvent) => void,
    _options?: SubscribeOptions
  ): Promise<SubscriptionHandle> {
    const subscriptionId = `clickhouse:${symbol}:${Date.now()}`;

    // ClickHouse doesn't support real-time streaming, simulate with polling
    const pollInterval = 5000; // 5 seconds

    const timer = setInterval(async () => {
      try {
        if (types.includes('quote')) {
          const response = await this.getQuote(symbol);
          if (response.success && response.data) {
            onData({
              type: 'quote',
              symbol,
              timestamp: Date.now(),
              data: response.data,
            });
          }
        }
      } catch (error) {
        console.error(`ClickHouse subscription error for ${symbol}:`, error);
      }
    }, pollInterval);

    this.subscriptions.set(subscriptionId, { timer, callback: onData });

    return {
      id: subscriptionId,
      symbol,
      unsubscribe: () => {
        const sub = this.subscriptions.get(subscriptionId);
        if (sub) {
          clearInterval(sub.timer);
          this.subscriptions.delete(subscriptionId);
        }
      },
      isActive: () => this.subscriptions.has(subscriptionId),
    };
  }

  async unsubscribeAll(): Promise<void> {
    for (const [, sub] of this.subscriptions) {
      clearInterval(sub.timer);
    }
    this.subscriptions.clear();
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  async ping(): Promise<number> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const start = Date.now();
    await this.client.query({
      query: 'SELECT 1',
      format: 'JSONEachRow',
    });
    return Date.now() - start;
  }

  getSupportedIntervals(_symbol: string): Interval[] {
    return SUPPORTED_INTERVALS;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private mapRowToSymbolInfo(row: CHSymbolRow): SymbolInfo {
    return {
      symbol: row.symbol,
      name: row.name || row.symbol,
      type: this.mapAssetType(row.type),
      exchange: this.mapExchange(row.exchange),
      currency: row.currency || 'USD',
      sector: row.sector,
      industry: row.industry,
      tradable: true,
    };
  }

  private mapAssetType(type?: string): AssetType {
    switch (type?.toLowerCase()) {
      case 'stock':
      case 'equity':
        return 'stock';
      case 'etf':
        return 'etf';
      case 'index':
        return 'index';
      case 'forex':
      case 'fx':
        return 'forex';
      case 'crypto':
      case 'cryptocurrency':
        return 'crypto';
      case 'futures':
      case 'future':
        return 'futures';
      case 'options':
      case 'option':
        return 'options';
      case 'bond':
        return 'bond';
      case 'commodity':
        return 'commodity';
      default:
        return 'stock';
    }
  }

  private mapExchange(exchange?: string): Exchange {
    switch (exchange?.toUpperCase()) {
      case 'NYSE':
        return 'NYSE';
      case 'NASDAQ':
      case 'NMS':
        return 'NASDAQ';
      case 'AMEX':
        return 'AMEX';
      case 'SSE':
        return 'SSE';
      case 'SZSE':
        return 'SZSE';
      case 'HKEX':
        return 'HKEX';
      case 'BINANCE':
        return 'BINANCE';
      case 'COINBASE':
        return 'COINBASE';
      default:
        return 'OTHER';
    }
  }
}

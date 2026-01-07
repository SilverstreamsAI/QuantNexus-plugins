/**
 * CSV Data Provider
 *
 * Local CSV file data provider for importing historical data.
 */

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
  Timestamp,
} from '@shared/types';

// =============================================================================
// CSV Configuration
// =============================================================================

export interface CSVConfig extends ProviderConfig {
  dataDir?: string;            // Directory for CSV files
  dateFormat?: string;         // Date format (default: ISO)
  delimiter?: string;          // CSV delimiter (default: ',')
  hasHeader?: boolean;         // First row is header (default: true)
  columnMapping?: {            // Column name mapping
    timestamp?: string;
    date?: string;
    time?: string;
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    volume?: string;
  };
}

// =============================================================================
// Default Column Names
// =============================================================================

const DEFAULT_COLUMN_NAMES = {
  timestamp: ['timestamp', 'time', 'date', 'datetime', 't'],
  open: ['open', 'o', 'opening', 'first'],
  high: ['high', 'h', 'max'],
  low: ['low', 'l', 'min'],
  close: ['close', 'c', 'closing', 'last', 'adj close', 'adjusted close'],
  volume: ['volume', 'v', 'vol'],
};

// =============================================================================
// CSVProvider Implementation
// =============================================================================

export class CSVProvider implements DataProvider {
  private config: CSVConfig | null = null;
  private ready = false;
  private loadedData: Map<string, OHLCVSeries> = new Map();

  // ===========================================================================
  // Metadata
  // ===========================================================================

  getInfo(): ProviderInfo {
    return {
      id: 'csv',
      name: 'CSV Import',
      description: 'Import historical data from local CSV files',
      requiresAuth: false,
      free: true,
      capabilities: this.getCapabilities(),
    };
  }

  private getCapabilities(): ProviderCapabilities {
    return {
      historicalOHLCV: true,
      realtimeQuotes: false,
      realtimeTrades: false,
      orderBook: false,
      intervals: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
      assetTypes: ['stock', 'etf', 'crypto', 'forex', 'futures', 'commodity'],
      exchanges: ['OTHER'],
      adjustedPrices: false,
      extendedHours: false,
      symbolSearch: true,
      fundamentals: false,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      connected: this.ready,
      authenticated: true,
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config as CSVConfig;
    this.ready = true;
  }

  async shutdown(): Promise<void> {
    this.loadedData.clear();
    this.ready = false;
    this.config = null;
  }

  isReady(): boolean {
    return this.ready;
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  async searchSymbols(query: string, _options?: SymbolSearchOptions): Promise<SymbolInfo[]> {
    // Search in loaded data
    const results: SymbolInfo[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, series] of this.loadedData) {
      if (key.toLowerCase().includes(lowerQuery)) {
        results.push({
          symbol: series.symbol,
          name: series.symbol,
          type: 'stock',
          exchange: 'OTHER',
          currency: 'USD',
        });
      }
    }

    return results;
  }

  async getSymbolInfo(symbol: string): Promise<DataResponse<SymbolInfo>> {
    const key = this.getDataKey(symbol);
    const series = this.loadedData.get(key);

    if (!series) {
      return {
        success: false,
        error: { code: 'SYMBOL_NOT_FOUND', message: `No data loaded for: ${symbol}` },
      };
    }

    return {
      success: true,
      data: {
        symbol: series.symbol,
        name: series.symbol,
        type: 'stock',
        exchange: 'OTHER',
        currency: 'USD',
      },
    };
  }

  async listSymbols(_options?: ListSymbolsOptions): Promise<SymbolInfo[]> {
    const symbols: SymbolInfo[] = [];

    for (const series of this.loadedData.values()) {
      symbols.push({
        symbol: series.symbol,
        name: series.symbol,
        type: 'stock',
        exchange: 'OTHER',
        currency: 'USD',
      });
    }

    return symbols;
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    const key = this.getDataKey(symbol);
    return this.loadedData.has(key);
  }

  // ===========================================================================
  // Historical Data
  // ===========================================================================

  async getHistoricalData(request: DataRequest): Promise<DataResponse<OHLCVSeries>> {
    const { symbol, interval, start, end, limit } = request;
    const key = this.getDataKey(symbol, interval);
    const series = this.loadedData.get(key);

    if (!series) {
      return {
        success: false,
        error: { code: 'NO_DATA', message: `No data loaded for ${symbol} ${interval}` },
      };
    }

    // Filter by time range
    let data = series.data;

    if (start) {
      const startTs = typeof start === 'string' ? new Date(start).getTime() : start;
      data = data.filter(bar => bar.timestamp >= startTs);
    }

    if (end) {
      const endTs = typeof end === 'string' ? new Date(end).getTime() : end;
      data = data.filter(bar => bar.timestamp <= endTs);
    }

    // Apply limit
    if (limit) {
      data = data.slice(-limit);
    }

    return {
      success: true,
      data: {
        symbol,
        interval,
        data,
        start: data.length > 0 ? data[0].timestamp : 0,
        end: data.length > 0 ? data[data.length - 1].timestamp : 0,
        source: 'csv',
      },
    };
  }

  // ===========================================================================
  // Real-time Data (Not Supported)
  // ===========================================================================

  async getQuote(_symbol: string): Promise<DataResponse<Quote>> {
    return {
      success: false,
      error: { code: 'PROVIDER_ERROR', message: 'CSV provider does not support real-time quotes' },
    };
  }

  async getQuotes(symbols: string[]): Promise<Map<string, DataResponse<Quote>>> {
    const results = new Map<string, DataResponse<Quote>>();
    for (const symbol of symbols) {
      results.set(symbol, {
        success: false,
        error: { code: 'PROVIDER_ERROR', message: 'CSV provider does not support real-time quotes' },
      });
    }
    return results;
  }

  async subscribe(
    _symbol: string,
    _types: DataEventType[],
    _onData: (event: DataEvent) => void,
    _options?: SubscribeOptions
  ): Promise<SubscriptionHandle> {
    throw new Error('CSV provider does not support subscriptions');
  }

  async unsubscribeAll(): Promise<void> {
    // No subscriptions to unsubscribe
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  async ping(): Promise<number> {
    return 0;
  }

  getSupportedIntervals(_symbol: string): Interval[] {
    return ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
  }

  // ===========================================================================
  // CSV Import Methods
  // ===========================================================================

  /**
   * Load data from CSV string
   */
  async loadFromString(
    symbol: string,
    interval: Interval,
    csvContent: string,
    options?: CSVConfig
  ): Promise<OHLCVSeries> {
    const config = { ...this.config, ...options };
    const delimiter = config?.delimiter || ',';
    const hasHeader = config?.hasHeader !== false;

    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty CSV content');
    }

    // Parse header
    let columnIndices: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };

    const startIndex = hasHeader ? 1 : 0;

    if (hasHeader) {
      const headers = this.parseLine(lines[0], delimiter).map(h => h.toLowerCase().trim());
      columnIndices = this.detectColumns(headers, config?.columnMapping);
    } else {
      // Assume standard order: timestamp, open, high, low, close, volume
      columnIndices = {
        timestamp: 0,
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        volume: 5,
      };
    }

    // Parse data rows
    const bars: OHLCV[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseLine(line, delimiter);
        const bar = this.parseRow(values, columnIndices, config?.dateFormat);
        if (bar) {
          bars.push(bar);
        }
      } catch (error) {
        console.warn(`Error parsing line ${i + 1}:`, error);
      }
    }

    // Sort by timestamp
    bars.sort((a, b) => a.timestamp - b.timestamp);

    const series: OHLCVSeries = {
      symbol,
      interval,
      data: bars,
      start: bars.length > 0 ? bars[0].timestamp : 0,
      end: bars.length > 0 ? bars[bars.length - 1].timestamp : 0,
      source: 'csv',
    };

    // Store in loaded data
    const key = this.getDataKey(symbol, interval);
    this.loadedData.set(key, series);

    return series;
  }

  /**
   * Clear loaded data
   */
  clearData(symbol?: string, interval?: Interval): void {
    if (!symbol) {
      this.loadedData.clear();
      return;
    }

    if (!interval) {
      // Clear all intervals for symbol
      for (const key of this.loadedData.keys()) {
        if (key.startsWith(`${symbol}:`)) {
          this.loadedData.delete(key);
        }
      }
      return;
    }

    const key = this.getDataKey(symbol, interval);
    this.loadedData.delete(key);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getDataKey(symbol: string, interval?: Interval): string {
    return interval ? `${symbol}:${interval}` : symbol;
  }

  private parseLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private detectColumns(
    headers: string[],
    mapping?: CSVConfig['columnMapping']
  ): {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } {
    const findColumn = (names: string[], customName?: string): number => {
      if (customName) {
        const idx = headers.indexOf(customName.toLowerCase());
        if (idx >= 0) return idx;
      }

      for (const name of names) {
        const idx = headers.indexOf(name);
        if (idx >= 0) return idx;
      }

      return -1;
    };

    const timestamp = findColumn(DEFAULT_COLUMN_NAMES.timestamp, mapping?.timestamp || mapping?.date);
    const open = findColumn(DEFAULT_COLUMN_NAMES.open, mapping?.open);
    const high = findColumn(DEFAULT_COLUMN_NAMES.high, mapping?.high);
    const low = findColumn(DEFAULT_COLUMN_NAMES.low, mapping?.low);
    const close = findColumn(DEFAULT_COLUMN_NAMES.close, mapping?.close);
    const volume = findColumn(DEFAULT_COLUMN_NAMES.volume, mapping?.volume);

    if (timestamp < 0) {
      throw new Error('Could not find timestamp/date column');
    }
    if (open < 0 || high < 0 || low < 0 || close < 0) {
      throw new Error('Could not find OHLC columns');
    }

    return { timestamp, open, high, low, close, volume };
  }

  private parseRow(
    values: string[],
    columns: { timestamp: number; open: number; high: number; low: number; close: number; volume: number },
    dateFormat?: string
  ): OHLCV | null {
    const timestampStr = values[columns.timestamp]?.trim();
    if (!timestampStr) return null;

    const timestamp = this.parseTimestamp(timestampStr, dateFormat);
    if (!timestamp) return null;

    const open = parseFloat(values[columns.open]);
    const high = parseFloat(values[columns.high]);
    const low = parseFloat(values[columns.low]);
    const close = parseFloat(values[columns.close]);
    const volume = columns.volume >= 0 ? parseFloat(values[columns.volume]) || 0 : 0;

    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
      return null;
    }

    return { timestamp, open, high, low, close, volume };
  }

  private parseTimestamp(value: string, _format?: string): Timestamp | null {
    // Try numeric timestamp first
    const numeric = parseFloat(value);
    if (!isNaN(numeric)) {
      // Determine if seconds or milliseconds
      if (numeric > 1e12) {
        return numeric; // Already milliseconds
      } else if (numeric > 1e9) {
        return numeric * 1000; // Seconds to milliseconds
      }
    }

    // Try ISO format
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }

    // Try common formats
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?/, // YYYY-MM-DD HH:MM:SS
      /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?/, // MM/DD/YYYY HH:MM:SS
      /(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?/, // YYYY/MM/DD HH:MM:SS
    ];

    for (const regex of formats) {
      const match = value.match(regex);
      if (match) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed.getTime();
        }
      }
    }

    return null;
  }
}

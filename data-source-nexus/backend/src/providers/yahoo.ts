/**
 * Yahoo Finance Data Provider
 *
 * Free data provider using Yahoo Finance API.
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
  OrderBook,
  DataRequest,
  DataResponse,
  DataEvent,
  DataEventType,
  SubscriptionHandle,
  Interval,
  Timestamp,
  AssetType,
  Exchange,
} from '@shared/types';

// =============================================================================
// Yahoo Finance API Types
// =============================================================================

interface YahooQuoteResponse {
  quoteResponse: {
    result: YahooQuote[];
    error: null | { code: string; description: string };
  };
}

interface YahooQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  exchange?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketPreviousClose?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number;
  bid?: number;
  bidSize?: number;
  ask?: number;
  askSize?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  marketCap?: number;
  sector?: string;
  industry?: string;
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: null | { code: string; description: string };
  };
}

interface YahooChartResult {
  meta: {
    symbol: string;
    currency: string;
    exchangeName: string;
    instrumentType: string;
    regularMarketPrice: number;
    previousClose: number;
    timezone: string;
    validRanges: string[];
  };
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: number[];
      high: number[];
      low: number[];
      close: number[];
      volume: number[];
    }>;
    adjclose?: Array<{
      adjclose: number[];
    }>;
  };
}

interface YahooSearchResponse {
  quotes: YahooSearchQuote[];
}

interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
  sector?: string;
  industry?: string;
}

// =============================================================================
// Yahoo Interval Mapping
// =============================================================================

const YAHOO_INTERVALS: Record<Interval, string> = {
  '1s': '1m',   // Yahoo doesn't support seconds, fallback to 1m
  '5s': '1m',
  '15s': '1m',
  '30s': '1m',
  '1m': '1m',
  '3m': '5m',   // Yahoo doesn't have 3m
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '1h',   // Yahoo doesn't have 2h
  '4h': '1h',   // Yahoo doesn't have 4h
  '6h': '1h',
  '12h': '1h',
  '1d': '1d',
  '3d': '1d',
  '1w': '1wk',
  '1M': '1mo',
};

const SUPPORTED_INTERVALS: Interval[] = [
  '1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M',
];

// =============================================================================
// YahooProvider Implementation
// =============================================================================

export class YahooProvider implements DataProvider {
  private config: ProviderConfig | null = null;
  private ready = false;
  private baseUrl = 'https://query1.finance.yahoo.com';
  private subscriptions: Map<string, { timer: ReturnType<typeof setInterval>; callback: (event: DataEvent) => void }> = new Map();

  // ===========================================================================
  // Metadata
  // ===========================================================================

  getInfo(): ProviderInfo {
    return {
      id: 'yahoo',
      name: 'Yahoo Finance',
      description: 'Free market data from Yahoo Finance',
      website: 'https://finance.yahoo.com',
      requiresAuth: false,
      free: true,
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
      exchanges: ['NYSE', 'NASDAQ', 'AMEX', 'OTHER'],
      adjustedPrices: true,
      extendedHours: false,
      symbolSearch: true,
      fundamentals: false,
      rateLimit: {
        requestsPerMinute: 60,
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const start = Date.now();
      await this.ping();
      const latency = Date.now() - start;

      return {
        connected: true,
        authenticated: true, // No auth required
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
    this.config = config;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }

    this.ready = true;
  }

  async shutdown(): Promise<void> {
    await this.unsubscribeAll();
    this.ready = false;
    this.config = null;
  }

  isReady(): boolean {
    return this.ready;
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  async searchSymbols(query: string, options?: SymbolSearchOptions): Promise<SymbolInfo[]> {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Yahoo search failed: ${response.statusText}`);
      }

      const data = await response.json() as YahooSearchResponse;

      return data.quotes
        .filter(q => q.symbol)
        .map(q => this.mapSearchQuoteToSymbolInfo(q))
        .slice(0, options?.limit || 20);
    } catch (error) {
      console.error('Yahoo search error:', error);
      return [];
    }
  }

  async getSymbolInfo(symbol: string): Promise<DataResponse<SymbolInfo>> {
    try {
      const quote = await this.fetchQuote(symbol);
      if (!quote) {
        return {
          success: false,
          error: { code: 'SYMBOL_NOT_FOUND', message: `Symbol not found: ${symbol}` },
        };
      }

      return {
        success: true,
        data: this.mapQuoteToSymbolInfo(quote),
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

  async listSymbols(_options?: ListSymbolsOptions): Promise<SymbolInfo[]> {
    // Yahoo doesn't provide a list endpoint
    // Return empty - users should use searchSymbols
    return [];
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const quote = await this.fetchQuote(symbol);
      return quote !== null;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Historical Data
  // ===========================================================================

  async getHistoricalData(request: DataRequest): Promise<DataResponse<OHLCVSeries>> {
    try {
      const { symbol, interval, start, end, limit } = request;

      // Calculate time range
      const endTs = end
        ? (typeof end === 'string' ? new Date(end).getTime() : end)
        : Date.now();
      const startTs = start
        ? (typeof start === 'string' ? new Date(start).getTime() : start)
        : endTs - 365 * 24 * 60 * 60 * 1000; // Default 1 year

      const yahooInterval = YAHOO_INTERVALS[interval] || '1d';
      const period1 = Math.floor(startTs / 1000);
      const period2 = Math.floor(endTs / 1000);

      const url = `${this.baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${yahooInterval}&includeAdjustedClose=true`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.statusText}`);
      }

      const data = await response.json() as YahooChartResponse;

      if (data.chart.error) {
        return {
          success: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: data.chart.error.description,
          },
        };
      }

      if (!data.chart.result || data.chart.result.length === 0) {
        return {
          success: false,
          error: { code: 'NO_DATA', message: 'No data returned' },
        };
      }

      const result = data.chart.result[0];
      const bars = this.parseChartData(result);

      // Apply limit if specified
      const limitedBars = limit ? bars.slice(-limit) : bars;

      const series: OHLCVSeries = {
        symbol,
        interval,
        data: limitedBars,
        start: limitedBars.length > 0 ? limitedBars[0].timestamp : startTs,
        end: limitedBars.length > 0 ? limitedBars[limitedBars.length - 1].timestamp : endTs,
        timezone: result.meta.timezone,
        adjusted: request.adjusted !== false,
        source: 'yahoo',
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

  // ===========================================================================
  // Real-time Data
  // ===========================================================================

  async getQuote(symbol: string): Promise<DataResponse<Quote>> {
    try {
      const quote = await this.fetchQuote(symbol);
      if (!quote) {
        return {
          success: false,
          error: { code: 'SYMBOL_NOT_FOUND', message: `Symbol not found: ${symbol}` },
        };
      }

      return {
        success: true,
        data: this.mapYahooQuoteToQuote(quote),
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

  async getQuotes(symbols: string[]): Promise<Map<string, DataResponse<Quote>>> {
    const results = new Map<string, DataResponse<Quote>>();

    try {
      const url = `${this.baseUrl}/v7/finance/quote?symbols=${symbols.join(',')}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.statusText}`);
      }

      const data = await response.json() as YahooQuoteResponse;

      if (data.quoteResponse.error) {
        for (const symbol of symbols) {
          results.set(symbol, {
            success: false,
            error: {
              code: 'PROVIDER_ERROR',
              message: data.quoteResponse.error.description,
            },
          });
        }
        return results;
      }

      // Map results
      const quoteMap = new Map<string, YahooQuote>();
      for (const quote of data.quoteResponse.result) {
        quoteMap.set(quote.symbol, quote);
      }

      for (const symbol of symbols) {
        const quote = quoteMap.get(symbol);
        if (quote) {
          results.set(symbol, {
            success: true,
            data: this.mapYahooQuoteToQuote(quote),
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
    const subscriptionId = `yahoo:${symbol}:${Date.now()}`;

    // Yahoo doesn't have real-time streaming, simulate with polling
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
        console.error(`Yahoo subscription error for ${symbol}:`, error);
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
    for (const [id, sub] of this.subscriptions) {
      clearInterval(sub.timer);
    }
    this.subscriptions.clear();
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  async ping(): Promise<number> {
    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/v7/finance/quote?symbols=AAPL`);
    if (!response.ok) {
      throw new Error('Ping failed');
    }
    return Date.now() - start;
  }

  getSupportedIntervals(_symbol: string): Interval[] {
    return SUPPORTED_INTERVALS;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async fetchQuote(symbol: string): Promise<YahooQuote | null> {
    const url = `${this.baseUrl}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Yahoo API error: ${response.statusText}`);
    }

    const data = await response.json() as YahooQuoteResponse;

    if (data.quoteResponse.error) {
      throw new Error(data.quoteResponse.error.description);
    }

    return data.quoteResponse.result[0] || null;
  }

  private parseChartData(result: YahooChartResult): OHLCV[] {
    const { timestamp, indicators } = result;
    const quote = indicators.quote[0];
    const adjclose = indicators.adjclose?.[0]?.adjclose;

    const bars: OHLCV[] = [];

    for (let i = 0; i < timestamp.length; i++) {
      // Skip null values
      if (
        quote.open[i] === null ||
        quote.high[i] === null ||
        quote.low[i] === null ||
        quote.close[i] === null
      ) {
        continue;
      }

      bars.push({
        timestamp: timestamp[i] * 1000, // Convert to ms
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: adjclose ? adjclose[i] : quote.close[i],
        volume: quote.volume[i] || 0,
      });
    }

    return bars;
  }

  private mapSearchQuoteToSymbolInfo(q: YahooSearchQuote): SymbolInfo {
    return {
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      type: this.mapQuoteType(q.quoteType),
      exchange: this.mapExchange(q.exchange || q.exchDisp),
      currency: 'USD', // Default, not always provided in search
      sector: q.sector,
      industry: q.industry,
    };
  }

  private mapQuoteToSymbolInfo(q: YahooQuote): SymbolInfo {
    return {
      symbol: q.symbol,
      name: q.longName || q.shortName || q.symbol,
      type: this.mapQuoteType(q.quoteType),
      exchange: this.mapExchange(q.exchange),
      currency: q.currency || 'USD',
      sector: q.sector,
      industry: q.industry,
      tradable: true,
    };
  }

  private mapYahooQuoteToQuote(q: YahooQuote): Quote {
    return {
      symbol: q.symbol,
      timestamp: (q.regularMarketTime || Math.floor(Date.now() / 1000)) * 1000,
      bid: q.bid || q.regularMarketPrice || 0,
      bidSize: q.bidSize || 0,
      ask: q.ask || q.regularMarketPrice || 0,
      askSize: q.askSize || 0,
      last: q.regularMarketPrice || 0,
      open: q.regularMarketOpen,
      high: q.regularMarketDayHigh,
      low: q.regularMarketDayLow,
      close: q.regularMarketPreviousClose,
      volume: q.regularMarketVolume,
      change: q.regularMarketChange,
      changePercent: q.regularMarketChangePercent,
    };
  }

  private mapQuoteType(type?: string): AssetType {
    switch (type?.toUpperCase()) {
      case 'EQUITY':
        return 'stock';
      case 'ETF':
        return 'etf';
      case 'INDEX':
        return 'index';
      case 'CURRENCY':
        return 'forex';
      case 'CRYPTOCURRENCY':
        return 'crypto';
      case 'FUTURE':
        return 'futures';
      case 'OPTION':
        return 'options';
      default:
        return 'stock';
    }
  }

  private mapExchange(exchange?: string): Exchange {
    switch (exchange?.toUpperCase()) {
      case 'NYQ':
      case 'NYSE':
        return 'NYSE';
      case 'NMS':
      case 'NGM':
      case 'NASDAQ':
        return 'NASDAQ';
      case 'ASE':
      case 'AMEX':
        return 'AMEX';
      default:
        return 'OTHER';
    }
  }
}

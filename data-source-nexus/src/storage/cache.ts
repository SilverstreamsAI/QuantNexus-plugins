/**
 * Memory Cache Implementation
 *
 * LRU-based in-memory cache for market data.
 */

import type {
  DataCache,
  CacheConfig,
  CacheStats,
  CacheEntryMeta,
  PartialCacheResult,
} from '@shared/types';
import type {
  OHLCV,
  OHLCVSeries,
  Quote,
  SymbolInfo,
  Interval,
  Timestamp,
} from '@shared/types';

// =============================================================================
// LRU Cache Node
// =============================================================================

interface CacheNode<T> {
  key: string;
  value: T;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
  expiresAt: number;
  sizeBytes: number;
  accessCount: number;
  createdAt: number;
  accessedAt: number;
}

// =============================================================================
// DataPluginCache Implementation
// =============================================================================

export class DataPluginCache implements DataCache {
  private config: CacheConfig | null = null;
  private cache: Map<string, CacheNode<unknown>> = new Map();
  private head: CacheNode<unknown> | null = null;
  private tail: CacheNode<unknown> | null = null;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };

  private memoryUsed = 0;
  private maxMemory = 256 * 1024 * 1024; // 256 MB default
  private defaultTTL = 300000; // 5 minutes default
  private quoteTTL = 1000; // 1 second
  private ohlcvTTL = 60000; // 1 minute
  private symbolTTL = 3600000; // 1 hour

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async initialize(config: CacheConfig): Promise<void> {
    this.config = config;

    if (config.maxMemoryMB) {
      this.maxMemory = config.maxMemoryMB * 1024 * 1024;
    }
    if (config.defaultTTL) {
      this.defaultTTL = config.defaultTTL;
    }
    if (config.quoteTTL) {
      this.quoteTTL = config.quoteTTL;
    }
    if (config.ohlcvTTL) {
      this.ohlcvTTL = config.ohlcvTTL;
    }
    if (config.symbolTTL) {
      this.symbolTTL = config.symbolTTL;
    }

    // Start cleanup interval
    this.startCleanupInterval();
  }

  async shutdown(): Promise<void> {
    this.clear();
    this.config = null;
  }

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private startCleanupInterval(): void {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.invalidateExpired();
    }, 60000);
  }

  // ===========================================================================
  // Generic Operations
  // ===========================================================================

  get<T>(key: string): T | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > node.expiresAt) {
      this.deleteNode(node);
      this.stats.misses++;
      return undefined;
    }

    // Move to head (LRU)
    this.moveToHead(node);
    node.accessCount++;
    node.accessedAt = Date.now();
    this.stats.hits++;

    return node.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);
    const sizeBytes = this.estimateSize(value);

    // Check if exists
    const existing = this.cache.get(key);
    if (existing) {
      this.memoryUsed -= existing.sizeBytes;
      this.deleteNode(existing);
    }

    // Evict if necessary
    while (this.memoryUsed + sizeBytes > this.maxMemory && this.tail) {
      this.evictLRU();
    }

    // Create new node
    const node: CacheNode<T> = {
      key,
      value,
      prev: null,
      next: null,
      expiresAt,
      sizeBytes,
      accessCount: 1,
      createdAt: now,
      accessedAt: now,
    };

    // Add to cache
    this.cache.set(key, node as CacheNode<unknown>);
    this.addToHead(node as CacheNode<unknown>);
    this.memoryUsed += sizeBytes;
    this.stats.sets++;
  }

  has(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    if (Date.now() > node.expiresAt) {
      this.deleteNode(node);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.deleteNode(node);
    this.stats.deletes++;
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.memoryUsed = 0;
  }

  keys(pattern?: string): string[] {
    if (!pattern) {
      return Array.from(this.cache.keys());
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  // ===========================================================================
  // Quote Operations
  // ===========================================================================

  getQuote(symbol: string): Quote | undefined {
    return this.get<Quote>(`quote:${symbol}`);
  }

  setQuote(symbol: string, quote: Quote): void {
    this.set(`quote:${symbol}`, quote, this.quoteTTL);
  }

  getQuotes(symbols: string[]): Map<string, Quote> {
    const result = new Map<string, Quote>();
    for (const symbol of symbols) {
      const quote = this.getQuote(symbol);
      if (quote) {
        result.set(symbol, quote);
      }
    }
    return result;
  }

  setQuotes(quotes: Map<string, Quote>): void {
    for (const [symbol, quote] of quotes) {
      this.setQuote(symbol, quote);
    }
  }

  // ===========================================================================
  // OHLCV Operations
  // ===========================================================================

  getOHLCV(
    symbol: string,
    interval: Interval,
    start: Timestamp,
    end: Timestamp
  ): OHLCVSeries | undefined {
    const key = this.buildOHLCVKey(symbol, interval, start, end);
    return this.get<OHLCVSeries>(key);
  }

  setOHLCV(series: OHLCVSeries): void {
    const key = this.buildOHLCVKey(series.symbol, series.interval, series.start, series.end);
    this.set(key, series, this.ohlcvTTL);
  }

  getOHLCVPartial(
    symbol: string,
    interval: Interval,
    start: Timestamp,
    end: Timestamp
  ): PartialCacheResult<OHLCVSeries> {
    // Check exact match first
    const exact = this.getOHLCV(symbol, interval, start, end);
    if (exact) {
      return { hit: 'full', data: exact };
    }

    // Look for overlapping cached series
    const prefix = `ohlcv:${symbol}:${interval}:`;
    const candidateKeys = this.keys(`ohlcv:${symbol}:${interval}:*`);

    for (const key of candidateKeys) {
      const cached = this.get<OHLCVSeries>(key);
      if (!cached) continue;

      // Check if cached range contains requested range
      if (cached.start <= start && cached.end >= end) {
        // Filter data to requested range
        const filteredData = cached.data.filter(
          bar => bar.timestamp >= start && bar.timestamp <= end
        );

        return {
          hit: 'full',
          data: {
            ...cached,
            data: filteredData,
            start,
            end,
          },
        };
      }

      // Check for partial overlap
      if (cached.start <= end && cached.end >= start) {
        const missingRanges: Array<{ start: Timestamp; end: Timestamp }> = [];

        if (cached.start > start) {
          missingRanges.push({ start, end: cached.start - 1 });
        }
        if (cached.end < end) {
          missingRanges.push({ start: cached.end + 1, end });
        }

        return {
          hit: 'partial',
          data: cached,
          missingRanges,
        };
      }
    }

    return { hit: 'miss' };
  }

  appendBar(symbol: string, interval: Interval, bar: OHLCV): void {
    // Find existing series that could be appended to
    const candidateKeys = this.keys(`ohlcv:${symbol}:${interval}:*`);

    for (const key of candidateKeys) {
      const cached = this.get<OHLCVSeries>(key);
      if (!cached) continue;

      // Only append if bar is after the last bar
      const lastBar = cached.data[cached.data.length - 1];
      if (lastBar && bar.timestamp > lastBar.timestamp) {
        cached.data.push(bar);
        cached.end = bar.timestamp;
        // Re-set to update cache
        this.set(key, cached, this.ohlcvTTL);
        return;
      }
    }
  }

  updateLatestBar(symbol: string, interval: Interval, bar: OHLCV): void {
    const candidateKeys = this.keys(`ohlcv:${symbol}:${interval}:*`);

    for (const key of candidateKeys) {
      const cached = this.get<OHLCVSeries>(key);
      if (!cached || cached.data.length === 0) continue;

      const lastBar = cached.data[cached.data.length - 1];
      if (lastBar && lastBar.timestamp === bar.timestamp) {
        cached.data[cached.data.length - 1] = bar;
        this.set(key, cached, this.ohlcvTTL);
        return;
      }
    }
  }

  // ===========================================================================
  // Symbol Operations
  // ===========================================================================

  getSymbolInfo(symbol: string): SymbolInfo | undefined {
    return this.get<SymbolInfo>(`symbol:${symbol}`);
  }

  setSymbolInfo(info: SymbolInfo): void {
    this.set(`symbol:${info.symbol}`, info, this.symbolTTL);
  }

  getSearchResults(query: string): SymbolInfo[] | undefined {
    return this.get<SymbolInfo[]>(`search:${query.toLowerCase()}`);
  }

  setSearchResults(query: string, results: SymbolInfo[]): void {
    this.set(`search:${query.toLowerCase()}`, results, this.symbolTTL);
  }

  // ===========================================================================
  // Invalidation
  // ===========================================================================

  invalidateSymbol(symbol: string): void {
    const keysToDelete = this.keys(`*:${symbol}*`);
    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  invalidateQuotes(): void {
    const keysToDelete = this.keys('quote:*');
    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  invalidateOHLCV(symbol: string, interval?: Interval): void {
    const pattern = interval
      ? `ohlcv:${symbol}:${interval}:*`
      : `ohlcv:${symbol}:*`;
    const keysToDelete = this.keys(pattern);
    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  invalidateExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, node] of this.cache) {
      if (now > node.expiresAt) {
        this.deleteNode(node);
        count++;
      }
    }

    return count;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  getStats(): CacheStats {
    const now = Date.now();
    let oldestEntry = now;
    let newestEntry = 0;

    for (const node of this.cache.values()) {
      if (node.createdAt < oldestEntry) oldestEntry = node.createdAt;
      if (node.createdAt > newestEntry) newestEntry = node.createdAt;
    }

    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      entries: this.cache.size,
      memoryUsedBytes: this.memoryUsed,
      memoryMaxBytes: this.maxMemory,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      evictions: this.stats.evictions,
      oldestEntry,
      newestEntry,
    };
  }

  getEntryMeta(key: string): CacheEntryMeta | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    return {
      key: node.key,
      createdAt: node.createdAt,
      accessedAt: node.accessedAt,
      expiresAt: node.expiresAt,
      accessCount: node.accessCount,
      sizeBytes: node.sizeBytes,
    };
  }

  // ===========================================================================
  // LRU List Operations
  // ===========================================================================

  private addToHead(node: CacheNode<unknown>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeFromList(node: CacheNode<unknown>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToHead(node: CacheNode<unknown>): void {
    if (node === this.head) return;
    this.removeFromList(node);
    this.addToHead(node);
  }

  private deleteNode(node: CacheNode<unknown>): void {
    this.removeFromList(node);
    this.cache.delete(node.key);
    this.memoryUsed -= node.sizeBytes;
  }

  private evictLRU(): void {
    if (this.tail) {
      this.deleteNode(this.tail);
      this.stats.evictions++;
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private buildOHLCVKey(
    symbol: string,
    interval: Interval,
    start: Timestamp,
    end: Timestamp
  ): string {
    return `ohlcv:${symbol}:${interval}:${start}:${end}`;
  }

  private estimateSize(obj: unknown): number {
    // Rough size estimation
    const json = JSON.stringify(obj);
    return json.length * 2; // UTF-16 chars
  }
}

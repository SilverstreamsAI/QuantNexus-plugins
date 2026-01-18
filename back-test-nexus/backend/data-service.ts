/**
 * Data Nexus Backend Service
 *
 * TICKET_142: Business logic for data operations.
 * Migrated from apps/desktop/src/main/ipc/data-handlers.ts
 *
 * This module contains the actual implementation of:
 * - Symbol search
 * - Coverage check
 * - Connection check
 * - Data ensure/download
 */

// =============================================================================
// Types
// =============================================================================

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: 'forex' | 'stock' | 'crypto';
  exchange?: string;
  status: string;
  startTime?: string;
  endTime?: string;
}

export interface CoverageCheckConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
}

export interface CoverageResult {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  totalBars: number;
  completeness: number;
  missingRanges?: { start: string; end: string }[];
  error?: string;
}

export interface ConnectionStatus {
  provider: string;
  connected: boolean;
  latencyMs?: number;
  version?: string;
  error?: string;
  lastCheck: string;
}

export interface EnsureDataConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
  provider?: string;
  forceDownload?: boolean;
}

export interface EnsureDataResult {
  success: boolean;
  symbol: string;
  dataType?: 'forex' | 'stock' | 'crypto';
  coverage?: {
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    totalBars: number;
    completeness: number;
  };
  source?: string;
  downloadStats?: {
    barsDownloaded: number;
    barsImported: number;
    chunksProcessed: number;
    durationMs: number;
  };
  error?: string;
}

// API Response Types
interface SymbolSearchApiResponse {
  success: boolean;
  data?: {
    symbols: { symbol: string; start_time?: string; end_time?: string }[];
  };
  error?: { message: string };
}

interface CoverageApiResponse {
  success?: boolean;
  complete?: boolean;
  start_date?: string;
  end_date?: string;
  total_rows?: number;
  completeness?: number;
  missing_ranges?: { start: string; end: string }[];
  source?: string;
}

interface UpdateDataApiResponse {
  rows_downloaded?: number;
  rows_imported?: number;
  total_rows?: number;
  duration_ms?: number;
}

// =============================================================================
// Dependencies (injected at initialization)
// =============================================================================

interface DataServiceDependencies {
  getAuthServerUrl: (pluginId: string) => Promise<string | null>;
  getAccessToken: () => Promise<string | null>;
  getClickHouseClient: () => {
    ping: () => Promise<{ connected: boolean; latencyMs?: number; version?: string; error?: string }>;
  };
  sendProgress: (event: string, data: unknown) => void;
  log: {
    info: (msg: string, ...args: unknown[]) => void;
    debug: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

let deps: DataServiceDependencies | null = null;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the data service with dependencies
 */
export function initialize(dependencies: DataServiceDependencies): void {
  deps = dependencies;
  deps.log.info('[DataService] Initialized');
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Classify symbol type (forex/stock/crypto)
 */
export function classifySymbol(symbol: string): 'forex' | 'stock' | 'crypto' {
  if (!symbol) return 'stock';

  const normalized = symbol.toUpperCase().trim();

  // Known forex pairs (6 chars, two currency codes)
  const currencyCodes = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD',
    'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'ZAR', 'MXN', 'TRY',
    'PLN', 'CZK', 'HUF', 'ILS', 'THB', 'CNY', 'CNH', 'KRW', 'INR', 'BRL', 'RUB',
  ]);

  // Check forex format (6 chars, two valid currency codes)
  if (/^[A-Z]{6}$/.test(normalized)) {
    const base = normalized.substring(0, 3);
    const quote = normalized.substring(3, 6);
    if (currencyCodes.has(base) && currencyCodes.has(quote) && base !== quote) {
      return 'forex';
    }
  }

  // Check crypto format (ends with USDT, BTC, etc.)
  const cryptoQuotes = ['USDT', 'BTC', 'ETH', 'BUSD', 'USD'];
  if (cryptoQuotes.some(q => normalized.endsWith(q)) && normalized.length > 4) {
    return 'crypto';
  }

  // Default to stock
  return 'stock';
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Search symbols via Backend REST API
 *
 * TICKET_137: Uses Cloudflare Tunnel to Python backend
 */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  if (!deps) throw new Error('DataService not initialized');

  const startTime = Date.now();
  deps.log.info(`[DataService] Symbol search initiated: query="${query}"`);

  // Minimum 2 character validation
  if (!query || query.length < 2) {
    deps.log.debug('[DataService] Symbol search skipped: query too short');
    return [];
  }

  // Use Backend REST API via Cloudflare Tunnel
  const API_BASE = process.env.DATA_API_URL || 'https://desktop-api.silvonastream.com';
  const endpoint = `${API_BASE}/api/v1/data/symbol/search`;
  deps.log.debug(`[DataService] Symbol search API: ${endpoint}`);

  // Get access token for authentication
  const accessToken = await deps.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, limit: 20 }),
  });

  if (!response.ok) {
    const errorMsg = `Symbol search failed: ${response.status}`;
    deps.log.error(`[DataService] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const result = await response.json() as SymbolSearchApiResponse;

  if (!result.success) {
    const errorMsg = result.error?.message || 'Search failed';
    deps.log.error(`[DataService] Symbol search error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const latency = Date.now() - startTime;
  const symbols = result.data?.symbols || [];
  deps.log.info(`[DataService] Symbol search completed in ${latency}ms, results: ${symbols.length}`);

  return symbols.map((s: { symbol: string; start_time?: string; end_time?: string }) => ({
    symbol: s.symbol,
    name: s.symbol,
    type: classifySymbol(s.symbol),
    exchange: undefined,
    status: 'available',
    startTime: s.start_time,
    endTime: s.end_time,
  }));
}

/**
 * Check data coverage for a symbol
 *
 * TICKET_127: Proxy pattern - tries plugin backend first, falls back to HTTP
 */
export async function checkCoverage(config: CoverageCheckConfig): Promise<CoverageResult> {
  if (!deps) throw new Error('DataService not initialized');

  deps.log.info(`[DataService] Coverage check: ${config.symbol}`);

  try {
    const backendUrl = await getBackendUrl();

    // TICKET_143: Updated to GET method per backend implementation
    const params = new URLSearchParams({
      symbol: config.symbol,
      start_date: config.startDate,
      end_date: config.endDate,
      interval: config.interval,
    });
    const response = await fetch(`${backendUrl}/api/data_source/check?${params}`);

    if (!response.ok) {
      throw new Error(`Coverage check failed: ${response.status}`);
    }

    const result = await response.json() as CoverageApiResponse;

    return {
      symbol: config.symbol,
      interval: config.interval,
      startDate: result.start_date || config.startDate,
      endDate: result.end_date || config.endDate,
      totalBars: result.total_rows || 0,
      completeness: result.completeness || 0,
      missingRanges: result.missing_ranges || [],
    };
  } catch (error) {
    deps.log.error('[DataService] Coverage check failed:', error);
    return {
      symbol: config.symbol,
      interval: config.interval,
      startDate: config.startDate,
      endDate: config.endDate,
      totalBars: 0,
      completeness: 0,
      missingRanges: [{ start: config.startDate, end: config.endDate }],
      error: error instanceof Error ? error.message : 'Coverage check failed',
    };
  }
}

/**
 * Check ClickHouse connection status
 *
 * TICKET_136: Fail Fast - ClickHouse only, no fallback
 */
export async function checkConnection(provider: string): Promise<ConnectionStatus> {
  if (!deps) throw new Error('DataService not initialized');

  if (provider !== 'clickhouse') {
    throw new Error(`Unsupported provider: ${provider}. Only 'clickhouse' is supported.`);
  }

  const chClient = deps.getClickHouseClient();
  const startTime = Date.now();
  const status = await chClient.ping();
  const latency = Date.now() - startTime;

  deps.log.info(`[DataService] ClickHouse connection check: connected=${status.connected}, latency=${latency}ms`);

  return {
    provider,
    connected: status.connected,
    latencyMs: status.latencyMs || latency,
    version: status.version,
    error: status.error,
    lastCheck: new Date().toISOString(),
  };
}

/**
 * Ensure data is available (download if needed)
 */
export async function ensureData(config: EnsureDataConfig): Promise<EnsureDataResult> {
  if (!deps) throw new Error('DataService not initialized');

  deps.log.info('[DataService] Ensuring data for:', config.symbol);

  try {
    const backendUrl = await getBackendUrl();

    // Send initial progress
    deps.sendProgress('data:progress', {
      symbol: config.symbol,
      phase: 'checking',
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      rowsProcessed: 0,
      message: 'Checking data availability...',
    });

    // First check if data exists (TICKET_143: Updated to GET method per backend implementation)
    const checkParams = new URLSearchParams({
      symbol: config.symbol,
      start_date: config.startDate,
      end_date: config.endDate,
      interval: config.interval,
    });
    const checkResponse = await fetch(`${backendUrl}/api/data_source/check?${checkParams}`);

    if (!checkResponse.ok) {
      throw new Error(`Data check failed: ${checkResponse.status}`);
    }

    const checkResult = await checkResponse.json() as CoverageApiResponse;
    deps.log.debug('[DataService] Check result:', checkResult);

    // If data complete and not forcing download, return
    if (checkResult.success && checkResult.complete && !config.forceDownload) {
      deps.sendProgress('data:progress', {
        symbol: config.symbol,
        phase: 'complete',
        progress: 1,
        currentChunk: 1,
        totalChunks: 1,
        rowsProcessed: checkResult.total_rows || 0,
        message: 'Data ready',
      });

      return {
        success: true,
        symbol: config.symbol,
        dataType: classifySymbol(config.symbol),
        coverage: {
          symbol: config.symbol,
          interval: config.interval,
          startDate: checkResult.start_date || config.startDate,
          endDate: checkResult.end_date || config.endDate,
          totalBars: checkResult.total_rows || 0,
          completeness: 1.0,
        },
        source: checkResult.source || 'clickhouse',
      };
    }

    // Need to download data
    deps.sendProgress('data:progress', {
      symbol: config.symbol,
      phase: 'downloading',
      progress: 0.1,
      currentChunk: 0,
      totalChunks: 1,
      rowsProcessed: 0,
      message: 'Downloading from data source...',
    });

    const updateResponse = await fetch(`${backendUrl}/api/update_data_source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: config.symbol,
        start_date: config.startDate,
        end_date: config.endDate,
        interval: config.interval,
        force_download: config.forceDownload || false,
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Data update failed: ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json() as UpdateDataApiResponse;
    deps.log.debug('[DataService] Update result:', updateResult);

    // Send completion progress
    deps.sendProgress('data:progress', {
      symbol: config.symbol,
      phase: 'complete',
      progress: 1,
      currentChunk: 1,
      totalChunks: 1,
      rowsProcessed: updateResult.rows_imported || updateResult.total_rows || 0,
      message: 'Data ready',
    });

    return {
      success: true,
      symbol: config.symbol,
      dataType: classifySymbol(config.symbol),
      coverage: {
        symbol: config.symbol,
        interval: config.interval,
        startDate: config.startDate,
        endDate: config.endDate,
        totalBars: updateResult.rows_imported || updateResult.total_rows || 0,
        completeness: 1.0,
      },
      source: 'network',
      downloadStats: {
        barsDownloaded: updateResult.rows_downloaded || 0,
        barsImported: updateResult.rows_imported || 0,
        chunksProcessed: 1,
        durationMs: updateResult.duration_ms || 0,
      },
    };
  } catch (error) {
    deps.log.error('[DataService] Ensure error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Download failed';

    deps.sendProgress('data:progress', {
      symbol: config.symbol,
      phase: 'error',
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      rowsProcessed: 0,
      message: errorMessage,
    });

    return {
      success: false,
      symbol: config.symbol,
      error: errorMessage,
    };
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

// TICKET_143: Use Desktop API Tunnel for data APIs (per TICKET_141 API Routing Architecture)
// OAuth uses ai.silvonastream.com, all other APIs use desktop-api.silvonastream.com
const DESKTOP_API_TUNNEL_URL = 'https://desktop-api.silvonastream.com';

async function getBackendUrl(): Promise<string> {
  if (!deps) throw new Error('DataService not initialized');
  return DESKTOP_API_TUNNEL_URL;
}

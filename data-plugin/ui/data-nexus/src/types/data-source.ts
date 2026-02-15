/**
 * Data Source Types
 *
 * PLUGIN_TICKET_018: Shared data source types for Tier 0 foundation plugin.
 * Consumed by both back-test-nexus and quant-lab-nexus.
 */

export interface DataSourceOption {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'checking';
  requiresAuth: boolean;
  /** TICKET_332: Connection probe latency in milliseconds */
  latencyMs?: number;
  /** TICKET_305: Provider-supported intervals in UI notation */
  intervals?: string[];
  /** TICKET_305: Max lookback per interval (e.g. { '1m': '7d' }) */
  maxLookback?: Record<string, string>;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
  /** Data availability start time from backend */
  startTime?: string;
  /** Data availability end time from backend */
  endTime?: string;
}

export type TimeframeOption = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

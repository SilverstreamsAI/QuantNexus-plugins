/**
 * TICKET_383: Shared executor result types (Tier 0)
 *
 * Canonical definitions consumed by both back-test-nexus and quant-lab-nexus.
 */

export interface ExecutorMetrics {
  totalPnl: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
}

export interface ExecutorTrade {
  entryTime: number;
  exitTime: number;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  commission: number;
  reason: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExecutorResult {
  success: boolean;
  errorMessage?: string;
  startTime: number;
  endTime: number;
  executionTimeMs: number;
  metrics: ExecutorMetrics;
  equityCurve: EquityPoint[];
  trades: ExecutorTrade[];
  candles: Candle[];
}

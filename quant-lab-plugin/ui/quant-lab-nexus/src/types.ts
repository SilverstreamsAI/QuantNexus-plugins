/**
 * Quant Lab Type Definitions
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 */

export type QuantLabSubPage = 'hub' | 'factory';

/**
 * PLUGIN_TICKET_010: Component detail for each slot (Analysis/Entry/Exit)
 */
export interface SignalChipComponent {
  algorithmName: string;
  timeframe: string;
}

export interface SignalChip {
  id: string;       // signal_source_registry.id
  name: string;     // signal_source_registry.name
  // PLUGIN_TICKET_010: Component details (from signal_source_registry)
  analysis?: SignalChipComponent;
  entry?: SignalChipComponent;
  exit?: SignalChipComponent;
  // Backtest metrics (display reference)
  sharpe?: number | null;
  winRate?: number | null;
  totalTrades?: number | null;
}

export interface CombinatorMethod {
  id: string;
  name: string;
  description: string;
}

/**
 * TICKET_276: Factor chip for Alpha Factory Factor layer.
 * Read-only factor data from backend (desktop-api.silvonastream.com).
 */
export interface FactorChip {
  id: string;          // factor_id from backend
  name: string;
  category: string;    // momentum, mean_reversion, volatility, etc.
  source: string;      // library, mined, custom
  factor_type: 'time_series' | 'cross_sectional'; // TICKET_281
  formula: string | null;
  ic: number | null;
  icir: number | null;
  sharpe: number | null;
}

/**
 * PLUGIN_TICKET_012: Summary item for config sidebar list.
 * Maps to alpha-factory:list-configs IPC response shape.
 */
export interface ConfigSummary {
  id: string;
  name: string;
  signalMethod: string;
  signalCount: number;
  factorCount: number;   // TICKET_276: Factor layer count
  exitCount: number;
  isActive: boolean;
  updatedAt: string;
}

/**
 * TICKET_275: Built-in risk override rules for Exit Factory.
 * Each rule has an enabled toggle and type-specific parameters.
 */

export interface CircuitBreakerRule {
  enabled: boolean;
  triggerPnl: number;
  cooldownBars: number;
  action: 'close_all' | 'reduce_to';
  reduceToPercent?: number;
}

export interface TimeLimitRule {
  enabled: boolean;
  maxHolding: number;
  unit: 'hours' | 'bars';
  action: 'close_all' | 'reduce_to';
}

export interface RegimeDetectionRule {
  enabled: boolean;
  indicator: 'ATR' | 'VIX' | 'RealizedVol';
  period: number;
  threshold: number;
  action: 'reduce_all' | 'close_all' | 'halt_new_entry';
  reducePercent?: number;
}

export interface DrawdownLimitRule {
  enabled: boolean;
  maxDrawdown: number;
  action: 'reduce_all' | 'close_all' | 'halt_trading';
}

export interface CorrelationCapRule {
  enabled: boolean;
  maxCorrelation: number;
  lookbackDays: number;
  action: 'skip_entry' | 'reduce_half';
}

export interface HardSafetyRule {
  maxLossPercent: number;
}

export interface ExitRules {
  circuitBreaker: CircuitBreakerRule;
  timeLimit: TimeLimitRule;
  regimeDetection: RegimeDetectionRule;
  drawdownLimit: DrawdownLimitRule;
  correlationCap: CorrelationCapRule;
  hardSafety: HardSafetyRule;
}

/**
 * PLUGIN_TICKET_015: Alpha Factory backtest data configuration
 */
export type OrderSizeUnit = 'cash' | 'percent' | 'shares';

export interface DataConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  orderSize: number;
  orderSizeUnit: OrderSizeUnit;
}

export type BacktestStatus = 'idle' | 'loading_data' | 'generating' | 'running' | 'completed' | 'error';

export interface BacktestResultSummary {
  taskId: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

/**
 * PLUGIN_TICKET_016: Executor result types for full result display.
 * Adapted from back-test-nexus BacktestResultPanel.tsx (lines 20-70) minus Candle type.
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

export interface ExecutorResult {
  success: boolean;
  errorMessage?: string;
  startTime: number;
  endTime: number;
  executionTimeMs: number;
  metrics: ExecutorMetrics;
  equityCurve: EquityPoint[];
  trades: ExecutorTrade[];
}

/**
 * Quant Lab Type Definitions
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 */

export type QuantLabSubPage = 'hub' | 'factory' | 'engineStore' | 'algorithmBrowser' | 'batchGeneration';

/**
 * TICKET_426_3: Persona constraint types for Alpha Factory persona selection.
 */
export interface PersonaDescription {
  must_include: string[];
  regime_bias: string[];
  holding_period: string;
  risk_style: string;
  forbidden: string[];
}

export interface PersonaItem {
  id: string;
  label: string;
  description: PersonaDescription;
}

/**
 * TICKET_426_1: Algorithm Browser item from nona_algorithms table.
 */
export interface AlgorithmBrowserItem {
  id: number;
  code: string;
  strategy_name: string;
  strategy_type: number;
  classification_metadata: string | null;
  strategy_rules: string | null;
  status: number;
  create_time: string;
}

/**
 * TICKET_426_1: Batch generation configuration for Alpha Factory.
 */
export interface BatchGenerationConfig {
  preference: string;
  regime: string;
  indicators: string[];
  quantity: number;
  persona: string | null;
  llmProvider: string;
  llmModel: string;
}

/**
 * TICKET_426_1: Batch generation status.
 */
export type BatchGenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

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
 * TICKET_285: Translation status for factor expressions.
 */
export type TranslationStatus = 'ok' | 'structured' | 'unsupported';

/**
 * TICKET_285: CS pipeline step types for cross-sectional factor execution plans.
 */
export interface CsOpStep {
  step: number;
  type: 'cs_op';
  op: 'rank' | 'scale' | 'neutralize';
  input: string;
  groupby?: string;
}

export interface TsOpStep {
  step: number;
  type: 'ts_op';
  op: 'decay_linear';
  input: string;
  window: number;
}

export interface QlibExprStep {
  step: number;
  type: 'qlib_expr';
  expr: string;
}

export type PipelineStep = CsOpStep | TsOpStep | QlibExprStep;

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
  translation_status?: TranslationStatus | null; // TICKET_285
  qlib_expr?: string | null;                     // TICKET_285
  cs_pipeline?: PipelineStep[] | null;           // TICKET_285
  ic: number | null;
  icir: number | null;
  sharpe: number | null;
}

/**
 * PLUGIN_TICKET_012: Summary item for config sidebar list.
 * Maps to alpha-factory:list-configs IPC response shape.
 */
/**
 * TICKET_286/287: Factor Engine info for Engine Store UI.
 * Maps to factor_engine_registry table rows.
 */
export interface FactorEngineInfo {
  engineId: string;
  displayName: string;
  description: string | null;
  pythonPackage: string | null;
  factorCount: number;
  examples: string | null;
  builtin: boolean;
  installed: boolean;
  version: string | null;
  installedAt: string | null;
}

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
  /** PLUGIN_TICKET_018: Data source provider ID (was hardcoded to ClickHouse) */
  dataSource: string;
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
 * TICKET_383: Canonical types moved to Tier 0 (data-plugin), re-exported here.
 */
export type {
  ExecutorMetrics,
  ExecutorTrade,
  EquityPoint,
  Candle,
  ExecutorResult,
} from '@plugins/data-plugin/types/executor';

/**
 * TICKET_077_P3: Per-timeframe download status for Alpha Factory backtest.
 */
export interface TimeframeDownloadStatus {
  timeframe: string;
  state: 'pending' | 'completed' | 'downloading' | 'error';
  /** Latest single-line progress message */
  message?: string;
  /** TICKET_077_P3: Rolling buffer of recent progress messages (CMD-style console) */
  messageBuffer?: string[];
}

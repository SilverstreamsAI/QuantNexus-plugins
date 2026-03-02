/**
 * Quant Lab Constants
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * TICKET_275: Exit Factory risk rule defaults and metadata
 */

import { CombinatorMethod, DataConfig, ExitRules, BatchGenerationConfig } from './types';

/**
 * PLUGIN_TICKET_010: Timeframe options for signal component dropdowns.
 * Same values as back-test-nexus TimeframeDropdown (cannot cross-plugin import).
 */
export const TIMEFRAME_OPTIONS = [
  '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M',
] as const;

/**
 * TICKET_426_1: Strategy type labels for Algorithm Browser display.
 */
export const STRATEGY_TYPE_LABELS: Record<number, string> = {
  1: 'Execution',
  3: 'Entry Signal',
  6: 'Exit Signal',
  9: 'Analysis',
};

/**
 * TICKET_426_1: Regime type options for batch generation.
 * Must match backend valid case_types via REGIME_TO_CASE_TYPE mapping
 * in batch-generation-handlers.ts (TREND_DETECTION, RANGE_DETECTION,
 * CONSOLIDATION_DETECTION, OSCILLATION_DETECTION).
 */
export const REGIME_TYPE_OPTIONS = [
  { value: 'trend', label: 'Trend' },
  { value: 'range', label: 'Range' },
  { value: 'consolidation', label: 'Consolidation' },
  { value: 'oscillation', label: 'Oscillation' },
] as const;

/**
 * TICKET_426_1: Indicator pool options for batch generation.
 */
export const INDICATOR_POOL_OPTIONS = [
  { value: 'RSI', label: 'RSI' },
  { value: 'MACD', label: 'MACD' },
  { value: 'SMA', label: 'SMA' },
  { value: 'EMA', label: 'EMA' },
  { value: 'Bollinger', label: 'Bollinger Bands' },
  { value: 'ADX', label: 'ADX' },
  { value: 'Stochastic', label: 'Stochastic' },
  { value: 'ATR', label: 'ATR' },
] as const;

/**
 * TICKET_426_1: Default values for batch generation.
 */
export const BATCH_GENERATION_DEFAULTS: Omit<BatchGenerationConfig, 'llmProvider' | 'llmModel'> = {
  preference: '',
  regime: 'mean_reversion',
  indicators: [],
  quantity: 5,
  persona: null,
};

/**
 * TICKET_426_2: LLM provider options for batch generation model selector.
 * Minimal subset for UI dropdown rendering. Cross-plugin imports prohibited
 * (Tier 1 -> Tier 1), so provider config is defined locally.
 * Must stay in sync with strategy-builder-nexus/src/config/llm-providers.ts.
 */
export interface LlmModelOption {
  id: string;
  name: string;
  description?: string;
}

export interface LlmProviderOption {
  id: string;
  name: string;
  models: LlmModelOption[];
}

export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  {
    id: 'NONA',
    name: 'Nona',
    models: [
      { id: 'nona-nexus', name: 'Nona Nexus', description: 'Default recommended' },
      { id: 'gpt-5.2', name: 'GPT-5.2', description: 'OpenAI flagship' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'OpenAI fast' },
      { id: 'claude-4-5-opus-latest', name: 'Claude 4.5 Opus', description: 'Best intelligence' },
      { id: 'claude-4-5-sonnet-latest', name: 'Claude 4.5 Sonnet', description: 'Balanced' },
      { id: 'claude-4-5-haiku-latest', name: 'Claude 4.5 Haiku', description: 'Fast' },
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Best value' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning' },
      { id: 'gemini-3-pro-latest', name: 'Gemini 3 Pro', description: 'Google flagship' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Google fast' },
      { id: 'grok-4', name: 'Grok-4', description: 'xAI flagship' },
      { id: 'qwen3-max', name: 'Qwen 3 Max', description: 'Best Chinese' },
    ],
  },
  {
    id: 'CLAUDE',
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-4-5-opus-latest', name: 'Claude 4.5 Opus', description: 'Best intelligence' },
      { id: 'claude-4-5-sonnet-latest', name: 'Claude 4.5 Sonnet', description: 'Balanced' },
      { id: 'claude-4-5-haiku-latest', name: 'Claude 4.5 Haiku', description: 'Fast' },
    ],
  },
  {
    id: 'OPENAI',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Most advanced' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Faster' },
    ],
  },
  {
    id: 'GEMINI',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3-pro-latest', name: 'Gemini 3 Pro', description: 'Flagship' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast' },
    ],
  },
  {
    id: 'DEEPSEEK',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Best value' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Reasoning' },
    ],
  },
  {
    id: 'GROK',
    name: 'xAI Grok',
    models: [
      { id: 'grok-4', name: 'Grok-4', description: 'Flagship' },
    ],
  },
  {
    id: 'QWEN',
    name: 'Alibaba Qwen',
    models: [
      { id: 'qwen3-max', name: 'Qwen 3 Max', description: 'Best Chinese' },
    ],
  },
];

export const SIGNAL_COMBINATOR_METHODS: CombinatorMethod[] = [
  { id: 'equal', name: 'Equal Weight', description: 'Simple average of all signals' },
  { id: 'sharpe_weighted', name: 'Sharpe Weighted', description: 'Weight by historical Sharpe ratio' },
  { id: 'correlation_adjusted', name: 'Correlation Adjusted', description: 'Penalize highly correlated signals' },
  { id: 'regime_based', name: 'Regime Based', description: 'Regime-dependent weights' },
];

/**
 * TICKET_276: Factor combinator methods for Alpha Factory Factor layer.
 */
export const FACTOR_COMBINATOR_METHODS: CombinatorMethod[] = [
  { id: 'equal_weight', name: 'Equal Weight', description: 'Simple average of all factor scores' },
  { id: 'ic_weighted', name: 'IC Weighted', description: 'Weight by historical Information Coefficient' },
  { id: 'regression', name: 'Statistical Regression', description: 'OLS regression on factor scores' },
  { id: 'pca', name: 'PCA Composite', description: 'Principal Component Analysis composite score' },
];

/**
 * TICKET_276: Factor category filter options.
 * TICKET_279: Updated to match backend Factor Library API values.
 */
export const FACTOR_CATEGORIES = [
  { value: 'momentum', label: 'Momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'volatility', label: 'Volatility' },
  { value: 'value', label: 'Value' },
  { value: 'volume', label: 'Volume' },
  { value: 'technical', label: 'Technical' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'statistic', label: 'Statistic' },
] as const;

/**
 * TICKET_285: Translation status display metadata.
 * Maps translation_status values to UI label and Tailwind color classes.
 */
export const TRANSLATION_STATUS_META = {
  ok:          { label: 'Evaluable',   textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15' },
  structured:  { label: 'Pipeline',    textClass: 'text-blue-400',    bgClass: 'bg-blue-500/15' },
  unsupported: { label: 'Unsupported', textClass: 'text-gray-400',    bgClass: 'bg-gray-500/15' },
} as const;

export const EXIT_COMBINATOR_METHODS: CombinatorMethod[] = [
  { id: 'any', name: 'Any', description: 'Any rule triggers exit (conservative)' },
  { id: 'all', name: 'All', description: 'All rules must trigger (aggressive)' },
  { id: 'majority', name: 'Majority', description: 'More than 50% rules trigger' },
  { id: 'priority', name: 'Priority', description: 'Check in priority order, first trigger wins' },
];

/**
 * TICKET_275: Default exit rules configuration.
 * Circuit Breaker enabled by default; others off.
 */
export const DEFAULT_EXIT_RULES: ExitRules = {
  circuitBreaker: {
    enabled: true,
    triggerPnl: -5,
    cooldownBars: 10,
    action: 'close_all',
  },
  timeLimit: {
    enabled: false,
    maxHolding: 48,
    unit: 'hours',
    action: 'close_all',
  },
  regimeDetection: {
    enabled: false,
    indicator: 'ATR',
    period: 14,
    threshold: 2.5,
    action: 'reduce_all',
    reducePercent: 50,
  },
  drawdownLimit: {
    enabled: false,
    maxDrawdown: -10,
    action: 'halt_trading',
  },
  correlationCap: {
    enabled: false,
    maxCorrelation: 0.7,
    lookbackDays: 30,
    action: 'skip_entry',
  },
  hardSafety: {
    maxLossPercent: -20,
  },
};

/**
 * TICKET_275: Metadata for each risk rule row (display order = priority).
 * Icon names reference lucide-react icons.
 */
export const RISK_RULE_META = [
  { key: 'circuitBreaker' as const, label: 'Circuit Breaker', icon: 'Zap', color: 'text-red-400', priority: 1 },
  { key: 'timeLimit' as const, label: 'Time Limit', icon: 'Clock', color: 'text-teal-400', priority: 2 },
  { key: 'regimeDetection' as const, label: 'Regime Detection', icon: 'Activity', color: 'text-amber-400', priority: 3 },
  { key: 'drawdownLimit' as const, label: 'Drawdown Limit', icon: 'TrendingDown', color: 'text-red-400', priority: 4 },
  { key: 'correlationCap' as const, label: 'Correlation Cap', icon: 'GitBranch', color: 'text-teal-400', priority: 5 },
] as const;

/**
 * TICKET_275: Available actions per rule type.
 */
export const RULE_ACTIONS = {
  circuitBreaker: [
    { value: 'close_all', label: 'Close All' },
    { value: 'reduce_to', label: 'Reduce To %' },
  ],
  timeLimit: [
    { value: 'close_all', label: 'Close All' },
    { value: 'reduce_to', label: 'Reduce To %' },
  ],
  regimeDetection: [
    { value: 'reduce_all', label: 'Reduce All' },
    { value: 'close_all', label: 'Close All' },
    { value: 'halt_new_entry', label: 'Halt New Entry' },
  ],
  drawdownLimit: [
    { value: 'reduce_all', label: 'Reduce All' },
    { value: 'close_all', label: 'Close All' },
    { value: 'halt_trading', label: 'Halt Trading' },
  ],
  correlationCap: [
    { value: 'skip_entry', label: 'Skip Entry' },
    { value: 'reduce_half', label: 'Reduce 50%' },
  ],
} as const;

/**
 * TICKET_275: Regime detection indicator options.
 */
export const REGIME_INDICATORS = [
  { value: 'ATR', label: 'ATR' },
  { value: 'VIX', label: 'VIX' },
  { value: 'RealizedVol', label: 'Realized Vol' },
] as const;

/**
 * TICKET_275: Time unit options for Time Limit rule.
 */
export const TIME_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'bars', label: 'Bars' },
] as const;

/**
 * PLUGIN_TICKET_015: Default data configuration for Alpha Factory backtest.
 */
export const DEFAULT_DATA_CONFIG: DataConfig = {
  dataSource: 'yfinance',
  symbol: '',
  startDate: '',
  endDate: '',
  initialCapital: 100000,
  orderSize: 95,
  orderSizeUnit: 'percent',
};

/**
 * Quant Lab Constants
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * TICKET_275: Exit Factory risk rule defaults and metadata
 */

import { CombinatorMethod, DataConfig, ExitRules } from './types';

/**
 * PLUGIN_TICKET_010: Timeframe options for signal component dropdowns.
 * Same values as back-test-nexus TimeframeDropdown (cannot cross-plugin import).
 */
export const TIMEFRAME_OPTIONS = [
  '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M',
] as const;

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
 */
export const FACTOR_CATEGORIES = [
  { value: 'momentum', label: 'Momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'volatility', label: 'Volatility' },
  { value: 'value', label: 'Value' },
  { value: 'quality', label: 'Quality' },
  { value: 'statistical', label: 'Statistical Arbitrage' },
] as const;

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
  symbol: '',
  startDate: '',
  endDate: '',
  initialCapital: 100000,
  orderSize: 95,
  orderSizeUnit: 'percent',
};

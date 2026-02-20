/**
 * Data Foundation Plugin (Tier 0)
 *
 * PLUGIN_TICKET_018: Shared data source components and types
 * for consumption by Tier 1 business plugins.
 */

// Types
export type {
  DataSourceOption,
  SymbolSearchResult,
  TimeframeOption,
} from './types/data-source';

// Config
export {
  DATA_PROVIDERS,
  getProviderBySecretKey,
  isPrimarySecretKey,
} from './config/data-providers';
export type { DataProvider } from './config/data-providers';

// Constants
export { DEFAULT_DATA_SOURCE } from './constants';

// TICKET_383: Shared executor types (Tier 0)
export type {
  ExecutorMetrics,
  ExecutorTrade,
  EquityPoint,
  Candle,
  ExecutorResult,
} from './types/executor';

// TICKET_383: Shared format utilities (Tier 0)
export {
  formatCurrency,
  formatPercent,
  formatRatio,
  formatDate,
  getColorClass,
  safeNum,
} from './utils/format-utils';

// TICKET_383: Shared downsample utilities (Tier 0)
export {
  MAX_RENDER_POINTS,
  safeMinMax,
  downsampleOHLC,
  downsampleLTTB,
} from './utils/downsample-utils';

// TICKET_383: Shared chart utilities (Tier 0)
export {
  CANDLE_COLOR_BULLISH,
  CANDLE_COLOR_BEARISH,
  CANDLE_COLOR_UNPROCESSED,
  getCandleColor,
  isCandleProcessed,
} from './utils/chart-utils';

// Components
export { DataSourceSelectField } from './components/DataSourceSelectField';

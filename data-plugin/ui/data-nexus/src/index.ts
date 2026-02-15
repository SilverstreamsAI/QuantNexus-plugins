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

// Components
export { DataSourceSelectField } from './components/DataSourceSelectField';

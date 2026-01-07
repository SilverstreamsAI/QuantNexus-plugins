/**
 * Data Source Nexus - UI Module Types
 *
 * Re-exports types from @shared/types for use in the UI module.
 * This file serves as a central point for type definitions.
 */

// Re-export from shared types
export type {
  // Plugin types
  PluginModule,
  PluginContext,
  PluginApi,
  Disposable,

  // Tree types
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,

  // View types
  ViewProvider,
  ViewElement,
  ViewOptions,

  // Data types
  OHLCVSeries,
  OHLCV,
  Quote,
  SymbolInfo,
  DataRequest,
  DataResponse,
  Interval,
} from '@shared/types';

// =============================================================================
// UI-specific Types
// =============================================================================

/**
 * Data tree node for sidebar display
 */
export interface DataNode {
  id: string;
  label: string;
  type: 'root' | 'provider' | 'symbol' | 'interval';
  status?: 'connected' | 'disconnected' | 'available' | 'missing';
  children?: DataNode[];
  parentId?: string;
  metadata?: {
    providerId?: string;
    symbol?: string;
    interval?: string;
  };
}

/**
 * Provider status for display
 */
export interface ProviderDisplayInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  latency?: number;
  lastError?: string;
}

/**
 * Data plugin configuration (UI-facing)
 */
export interface DataPluginUIConfig {
  activeProviderId?: string;
  providers: ProviderDisplayInfo[];
}

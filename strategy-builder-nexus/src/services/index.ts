/**
 * Plugin Services Exports (TICKET_091)
 */

export {
  executeMarketRegimeAnalysis,
  validateMarketRegimeConfig,
  getErrorMessage,
  ERROR_CODE_MESSAGES,
} from './market-regime-service';

export type {
  MarketRegimeConfig,
  MarketRegimeRule,
  MarketRegimeResult,
} from './market-regime-service';

// =============================================================================
// Regime Indicator Entry Service (TICKET_203) - Correct API for Entry Signals
// =============================================================================

export {
  executeRegimeIndicatorEntry,
  validateRegimeIndicatorEntryConfig,
  getEntryErrorMessage,
  ENTRY_ERROR_CODE_MESSAGES,
} from './regime-indicator-entry-service';

export type {
  RegimeIndicatorEntryConfig,
  IndicatorEntryRule,
  RegimeIndicatorEntryResult,
} from './regime-indicator-entry-service';

// =============================================================================
// Algorithm Storage Service (TICKET_077_D1) - NEW Centralized Service
// =============================================================================

export {
  // Service
  AlgorithmStorageService,
  getAlgorithmStorageService,
  // Enums
  StorageMode,
  StrategyType,
  SignalSource,
  // Factory functions
  buildKronosIndicatorEntryRequest,
  buildRegimeDetectorRequest,
  buildEntrySignalRequest,
  extractClassName,
} from './algorithm-storage-service';

export type {
  AlgorithmSaveRequest,
  AlgorithmSaveResult,
  ClassificationMetadata,
  // Note: Storage types are for algorithm-storage-service internal use
  // Use RegimeIndicatorEntryResult/Config from regime-indicator-entry-service for API calls
  RegimeDetectorResult,
  RegimeDetectorConfig,
  EntrySignalResult,
  EntrySignalConfig,
} from './algorithm-storage-service';

// =============================================================================
// Legacy Algorithm Save Service (DEPRECATED - use AlgorithmStorageService)
// =============================================================================

/** @deprecated Use getAlgorithmStorageService().save() instead */
export {
  saveAlgorithm,
  saveAlgorithmSilent,
} from './algorithm-save-service';

/** @deprecated Use AlgorithmSaveRequest instead */
export type {
  AlgorithmSaveData,
  AlgorithmGenerationConfig,
  AlgorithmSaveResult as LegacyAlgorithmSaveResult,
} from './algorithm-save-service';

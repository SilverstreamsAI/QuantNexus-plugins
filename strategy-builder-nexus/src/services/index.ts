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
  KronosIndicatorEntryResult,
  KronosIndicatorEntryConfig,
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

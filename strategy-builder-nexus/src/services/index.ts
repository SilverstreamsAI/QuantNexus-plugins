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
// Kronos Indicator Entry Service (TICKET_208) - Kronos Mode Entry Signals
// =============================================================================

export {
  executeKronosIndicatorEntry,
  validateKronosIndicatorEntryConfig,
  getKronosEntryErrorMessage,
  KRONOS_ENTRY_ERROR_CODE_MESSAGES,
} from './kronos-indicator-entry-service';

export type {
  KronosIndicatorEntryConfig,
  KronosIndicatorRule,
  KronosIndicatorEntryResult,
} from './kronos-indicator-entry-service';

// =============================================================================
// Kronos AI Entry Service (TICKET_211) - LLM-powered Entry Signals
// =============================================================================

export {
  executeKronosAIEntry,
  validateKronosAIEntryConfig,
  getKronosAIEntryErrorMessage,
  getDefaultBespokeConfig,
  getPresetModeDescription,
  KRONOS_AI_ENTRY_ERROR_CODE_MESSAGES,
} from './kronos-ai-entry-service';

export type {
  KronosAIEntryConfig,
  KronosAIEntryResult,
  TraderPresetMode,
  BespokeConfig,
  RawIndicatorBlock,
} from './kronos-ai-entry-service';

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
  buildKronosPredictorRequest,
  buildKronosAIEntryRequest,
  extractClassName,
} from './algorithm-storage-service';

export type {
  AlgorithmSaveRequest,
  AlgorithmSaveResult,
  ClassificationMetadata,
  // TICKET_212: Algorithm list types
  AlgorithmListItem,
  AlgorithmListResult,
  // Note: Storage types are for algorithm-storage-service internal use
  // Use RegimeIndicatorEntryResult/Config from regime-indicator-entry-service for API calls
  RegimeDetectorResult,
  RegimeDetectorConfig,
  EntrySignalResult,
  EntrySignalConfig,
  KronosPredictorResult,
  KronosPredictorConfig,
  // TICKET_211: Kronos AI Entry storage types
  KronosAIEntryResult as StorageKronosAIEntryResult,
  KronosAIEntryConfig as StorageKronosAIEntryConfig,
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

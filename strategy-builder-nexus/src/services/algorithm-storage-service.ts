/**
 * Centralized Algorithm Storage Service
 *
 * Follows backend StrategyStorageService pattern exactly.
 * Handles all strategy types with proper metadata mapping.
 *
 * @see TICKET_077_D1_CENTRALIZED_ALGORITHM_STORAGE_SERVICE.md
 * @see /app/nona_server/src/services/strategy_storage_service.py
 */

// =============================================================================
// Enums (matches backend constants)
// =============================================================================

/**
 * Storage mode enumeration (matches backend StorageMode)
 */
export enum StorageMode {
  LOCAL = 'local',    // Save to desktop SQLite only
  REMOTE = 'remote',  // Save to server MySQL only
  HYBRID = 'hybrid',  // Save to both
}

/**
 * Strategy type constants (matches backend constants/business/strategy.py)
 */
export enum StrategyType {
  TYPE_EXECUTION = 0,
  TYPE_TREND = 1,
  TYPE_RANGE = 2,
  TYPE_ENTRY_SIGNAL = 3,  // TICKET_210: Renamed from TYPE_SHOCK to match backend standard
  TYPE_PRECONDITION = 7,
  TYPE_POSTCONDITION = 8,
  TYPE_ANALYSIS = 9,
  TYPE_DIRECTOR = 10,
  TYPE_KRONOS_PREDICTOR = 11,
  TYPE_KRONOS_LLM_ENTRY = 12,
}

/**
 * Signal source constants (matches backend SignalSourceConstants)
 */
export enum SignalSource {
  INDICATOR_DETECTOR = 'indicator_detector',
  KRONOS_INDICATOR_ENTRY = 'kronos_indicator_entry',
  KRONOS_PREDICTOR = 'kronos_predictor',
  KRONOS_LLM_ENTRY = 'kronos_llm_entry',
  AI_ENTRY = 'ai_entry',
  MARKET_REGIME = 'market_regime',
}

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Classification metadata (matches backend WordPress standard)
 */
export interface ClassificationMetadata {
  signal_source: SignalSource | string;
  strategy_role: string;
  trading_style?: string;
  strategy_composition?: string;
  class_name: string;
  components?: Record<string, unknown>;
  tags?: string[];
  created_at?: string;

  // Type-specific fields
  entry_signal_base?: string;  // For Kronos Indicator Entry
  regime_type?: string;        // For Regime Detector
}

/**
 * Algorithm save request (unified interface)
 */
export interface AlgorithmSaveRequest {
  // Required fields
  strategy_name: string;
  code: string;
  user_id: string;
  strategy_type: StrategyType;

  // Storage control
  storage_mode?: StorageMode;  // Default: LOCAL

  // Metadata (dynamic based on strategy type)
  classification_metadata: ClassificationMetadata;
  strategy_rules?: Record<string, unknown>;
  description?: string;
}

/**
 * Save result
 */
export interface AlgorithmSaveResult {
  success: boolean;
  data?: {
    id: number;
    strategy_name: string;
    storage_mode: StorageMode;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Factory Function Input Types
// =============================================================================

export interface KronosIndicatorEntryResult {
  strategy_name: string;
  strategy_code: string;
  class_name: string;
  entry_signal_base: string;
  strategy_id?: number | null;
  created_at?: string;
}

export interface KronosIndicatorEntryConfig {
  user_id?: string;
  longEntryIndicators: Array<Record<string, unknown>>;
  shortEntryIndicators: Array<Record<string, unknown>>;
}

export interface RegimeDetectorResult {
  strategy_name: string;
  strategy_code: string;
  class_name: string;
}

export interface RegimeDetectorConfig {
  user_id?: string;
  regime: string;
  llm_provider?: string;
  llm_model?: string;
  indicators?: unknown[];
  rules?: unknown[];
}

export interface EntrySignalResult {
  strategy_name: string;
  strategy_code: string;
  class_name: string;
}

export interface EntrySignalConfig {
  user_id?: string;
  regime: string;
  indicator_blocks?: unknown[];
  factor_blocks?: unknown[];
  llm_provider?: string;
  llm_model?: string;
}

/**
 * Kronos Predictor result from API
 */
export interface KronosPredictorResult {
  strategy_name: string;
  strategy_code: string;
  class_name: string;
}

/**
 * Kronos Predictor configuration
 */
export interface KronosPredictorConfig {
  user_id?: string;
  model_version: string;
  lookback: number;
  pred_len: number;
  temperature: number;
  top_p: number;
  top_k: number;
  sample_count: number;
  signal_filter: {
    filters: {
      confidence: { enabled: boolean; min_value: number };
      expected_return: { enabled: boolean; min_value: number };
      direction_filter: { enabled: boolean; mode: string };
      magnitude: { enabled: boolean; min_value: number };
      consistency: { enabled: boolean; min_value: number };
    };
    combination_logic: 'AND' | 'OR';
  };
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Centralized Algorithm Storage Service
 *
 * Singleton pattern for consistent state management.
 * All strategy types use this single entry point.
 */
export class AlgorithmStorageService {
  private static instance: AlgorithmStorageService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AlgorithmStorageService {
    if (!this.instance) {
      this.instance = new AlgorithmStorageService();
    }
    return this.instance;
  }

  /**
   * Parse storage mode string to enum
   */
  parseStorageMode(mode?: string): StorageMode {
    if (!mode) return StorageMode.LOCAL;
    const normalized = mode.toLowerCase();
    if (normalized === 'remote') return StorageMode.REMOTE;
    if (normalized === 'hybrid') return StorageMode.HYBRID;
    return StorageMode.LOCAL;
  }

  /**
   * Check if should persist to local SQLite
   *
   * LOCAL mode: Save to desktop SQLite
   * REMOTE mode: Skip local (server handles it)
   * HYBRID mode: Save to both
   */
  shouldPersistLocal(mode: StorageMode): boolean {
    return mode === StorageMode.LOCAL || mode === StorageMode.HYBRID;
  }

  /**
   * Save algorithm to local SQLite
   *
   * Central entry point for all strategy types.
   */
  async save(request: AlgorithmSaveRequest): Promise<AlgorithmSaveResult> {
    const storageMode = this.parseStorageMode(request.storage_mode);

    console.log('[AlgorithmStorageService] Save request:', {
      strategy_name: request.strategy_name,
      strategy_type: request.strategy_type,
      storage_mode: storageMode,
    });

    // Check if should persist locally
    if (!this.shouldPersistLocal(storageMode)) {
      console.log(
        `[AlgorithmStorageService] Skipping local storage (mode=${storageMode})`
      );
      return {
        success: true,
        data: {
          id: 0,
          strategy_name: request.strategy_name,
          storage_mode: storageMode,
        },
      };
    }

    try {
      // Build database record
      const record = this.buildDatabaseRecord(request);

      console.log('[AlgorithmStorageService] Saving to database:', {
        strategy_name: record.strategy_name,
        strategy_type: record.strategy_type,
        code_length: (record.code as string).length,
      });

      // Call Hub API to save
      const response = await window.electronAPI.hub.invokeEntity(
        'save',
        'nona_algorithm',
        record,
        'com.quantnexus.strategy-builder-nexus'
      );

      if (response.success) {
        console.log(
          `[AlgorithmStorageService] Saved successfully: id=${response.data}, name=${request.strategy_name}`
        );

        // Show success notification
        window.nexus?.window?.showNotification(
          `Strategy "${request.strategy_name}" saved successfully`,
          'success'
        );

        return {
          success: true,
          data: {
            id: response.data,
            strategy_name: request.strategy_name,
            storage_mode: storageMode,
          },
        };
      } else {
        console.error('[AlgorithmStorageService] Save failed:', response.error);

        // Show error notification
        window.nexus?.window?.showNotification(
          `Failed to save strategy: ${response.error?.message || 'Unknown error'}`,
          'error'
        );

        return {
          success: false,
          error: response.error || {
            code: 'SAVE_FAILED',
            message: 'Unknown error occurred',
          },
        };
      }
    } catch (error) {
      console.error('[AlgorithmStorageService] Save exception:', error);

      // Show error notification
      window.nexus?.window?.showNotification(
        'Failed to save strategy',
        'error'
      );

      return {
        success: false,
        error: {
          code: 'SAVE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Save without showing notifications (for batch operations)
   */
  async saveSilent(request: AlgorithmSaveRequest): Promise<AlgorithmSaveResult> {
    const storageMode = this.parseStorageMode(request.storage_mode);

    if (!this.shouldPersistLocal(storageMode)) {
      return {
        success: true,
        data: {
          id: 0,
          strategy_name: request.strategy_name,
          storage_mode: storageMode,
        },
      };
    }

    try {
      const record = this.buildDatabaseRecord(request);

      const response = await window.electronAPI.hub.invokeEntity(
        'save',
        'nona_algorithm',
        record,
        'com.quantnexus.strategy-builder-nexus'
      );

      if (response.success) {
        return {
          success: true,
          data: {
            id: response.data,
            strategy_name: request.strategy_name,
            storage_mode: storageMode,
          },
        };
      } else {
        return {
          success: false,
          error: response.error,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SAVE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Build database record from request
   */
  private buildDatabaseRecord(request: AlgorithmSaveRequest): Record<string, unknown> {
    // Ensure created_at is set
    const metadata: ClassificationMetadata = {
      ...request.classification_metadata,
      created_at: request.classification_metadata.created_at || new Date().toISOString(),
    };

    return {
      code: request.code,
      strategy_name: request.strategy_name,
      strategy_type: request.strategy_type,
      classification_metadata: JSON.stringify(metadata),
      strategy_rules: request.strategy_rules
        ? JSON.stringify(request.strategy_rules)
        : null,
      description: request.description || null,
      user_id: request.user_id,
      file_path: `generated/${request.strategy_name}.py`,
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Build save request for Kronos Indicator Entry
 */
export function buildKronosIndicatorEntryRequest(
  result: KronosIndicatorEntryResult,
  config: KronosIndicatorEntryConfig
): AlgorithmSaveRequest {
  return {
    strategy_name: result.strategy_name,
    code: result.strategy_code,
    user_id: config.user_id || 'default',
    strategy_type: StrategyType.TYPE_EXECUTION,
    storage_mode: StorageMode.LOCAL,
    classification_metadata: {
      signal_source: SignalSource.KRONOS_INDICATOR_ENTRY,
      strategy_role: 'execution',
      trading_style: 'indicator_confirmation',
      strategy_composition: 'atomic',
      class_name: result.class_name,
      entry_signal_base: result.entry_signal_base,
      components: {
        kronos_indicator_entry: {
          longEntryIndicators: config.longEntryIndicators,
          shortEntryIndicators: config.shortEntryIndicators,
        },
      },
      tags: ['kronos', 'indicator_entry', result.entry_signal_base],
      created_at: result.created_at || new Date().toISOString(),
    },
    strategy_rules: {
      entry_signal_base: result.entry_signal_base,
      indicators: {
        long: config.longEntryIndicators,
        short: config.shortEntryIndicators,
      },
    },
  };
}

/**
 * Build save request for Regime Detector
 */
export function buildRegimeDetectorRequest(
  result: RegimeDetectorResult,
  config: RegimeDetectorConfig
): AlgorithmSaveRequest {
  return {
    strategy_name: result.strategy_name,
    code: result.strategy_code,
    user_id: config.user_id || 'default',
    strategy_type: StrategyType.TYPE_ANALYSIS,
    storage_mode: StorageMode.LOCAL,
    classification_metadata: {
      signal_source: `indicator_detector_${config.regime}`,
      strategy_role: 'market_regime',
      trading_style: 'neutral',
      strategy_composition: 'atomic',
      class_name: result.class_name,
      regime_type: config.regime,
      components: {
        indicator: {
          regime_type: config.regime,
          llm_provider: config.llm_provider,
          llm_model: config.llm_model,
        },
      },
      tags: ['indicator', 'regime', 'market-analysis'],
    },
    strategy_rules: {
      regime_type: config.regime,
      indicators: config.indicators || [],
      rules: config.rules || [],
    },
  };
}

/**
 * Build save request for Entry Signal Generator
 * TICKET_210: Fixed strategy_type and signal_source to match backend standard
 */
export function buildEntrySignalRequest(
  result: EntrySignalResult,
  config: EntrySignalConfig
): AlgorithmSaveRequest {
  return {
    strategy_name: result.strategy_name,
    code: result.strategy_code,
    user_id: config.user_id || 'default',
    strategy_type: StrategyType.TYPE_ENTRY_SIGNAL,  // TICKET_210: Fix 0 -> 3
    storage_mode: StorageMode.LOCAL,
    classification_metadata: {
      signal_source: `indicator_entry_${config.regime}`,  // TICKET_210: Fix to indicator_entry_{base}
      strategy_role: 'execution',
      trading_style: 'indicator_confirmation',
      strategy_composition: 'atomic',
      class_name: result.class_name,
      regime_type: config.regime,
      components: {
        indicator_blocks: config.indicator_blocks || [],
        factor_blocks: config.factor_blocks || [],
      },
      tags: ['entry', 'signal', config.regime],
    },
    strategy_rules: {
      regime_type: config.regime,
      indicator_blocks: config.indicator_blocks || [],
      factor_blocks: config.factor_blocks || [],
    },
  };
}

/**
 * Build save request for Kronos Predictor (TICKET_207)
 */
export function buildKronosPredictorRequest(
  result: KronosPredictorResult,
  config: KronosPredictorConfig
): AlgorithmSaveRequest {
  return {
    strategy_name: result.strategy_name,
    code: result.strategy_code,
    user_id: config.user_id || 'default',
    strategy_type: StrategyType.TYPE_KRONOS_PREDICTOR,
    storage_mode: StorageMode.LOCAL,
    classification_metadata: {
      signal_source: SignalSource.KRONOS_PREDICTOR,
      strategy_role: 'prediction',
      trading_style: 'ai_driven',
      strategy_composition: 'atomic',
      class_name: result.class_name,
      components: {
        kronos_predictor: {
          model_version: config.model_version,
          lookback: config.lookback,
          pred_len: config.pred_len,
          temperature: config.temperature,
          top_p: config.top_p,
          top_k: config.top_k,
          sample_count: config.sample_count,
        },
        signal_filter: config.signal_filter,
      },
      tags: ['kronos', 'predictor', 'ai', config.model_version],
    },
    strategy_rules: {
      model_version: config.model_version,
      prediction_settings: {
        lookback: config.lookback,
        pred_len: config.pred_len,
      },
      advanced_settings: {
        temperature: config.temperature,
        top_p: config.top_p,
        top_k: config.top_k,
        sample_count: config.sample_count,
      },
      signal_filter: config.signal_filter,
    },
  };
}

/**
 * Extract class name from generated Python code
 */
export function extractClassName(code: string): string {
  const classMatch = code.match(/class\s+(\w+)\s*\(/);
  return classMatch ? classMatch[1] : 'GeneratedStrategy';
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Get singleton instance of AlgorithmStorageService
 */
export function getAlgorithmStorageService(): AlgorithmStorageService {
  return AlgorithmStorageService.getInstance();
}

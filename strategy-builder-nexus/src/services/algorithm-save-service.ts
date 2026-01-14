/**
 * Algorithm Save Service
 *
 * Reusable service for saving generated algorithms to the database.
 * Used across multiple pages (RegimeDetector, EntrySignal, etc.)
 *
 * @see TICKET_077_COMPONENT7_SAVE_MISSING
 * @see TICKET_117_1 - Unified Data Hub Pattern
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Algorithm data structure matching nona_algorithms table schema
 */
export interface AlgorithmSaveData {
  /** Algorithm identifier code (e.g., "REG_001") */
  code: string;
  /** Display name of the strategy */
  strategy_name: string;
  /** Strategy type (9=Regime Detector, 4=Pre-condition, etc.) */
  strategy_type: number;
  /** JSON metadata (regime, llm_provider, llm_model, etc.) */
  classification_metadata: string;
  /** Generated code/rules in JSON format */
  strategy_rules?: string;
  /** Description of the algorithm */
  description?: string;
  /** Owner user ID */
  user_id: string;
  /** Optional file path */
  file_path?: string;
}

/**
 * Configuration for algorithm generation
 */
export interface AlgorithmGenerationConfig {
  /** Strategy name from user input */
  strategy_name: string;
  /** Strategy type (9=Regime Detector, 10=Entry Signal, etc.) */
  strategy_type: number;
  /** Generated Python/strategy code */
  generated_code: string;
  /** Classification metadata (regime type, indicators, etc.) */
  metadata: Record<string, any>;
  /** Optional strategy rules */
  rules?: Record<string, any>;
  /** Optional description */
  description?: string;
  /** Optional user ID (defaults to 'default') */
  user_id?: string;
}

/**
 * Result of save operation
 */
export interface AlgorithmSaveResult {
  success: boolean;
  data?: {
    id: number;
    code: string;
    strategy_name: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique algorithm code based on strategy type and count
 *
 * @param strategyType - Strategy type number
 * @returns Generated code (e.g., "REG_001", "ENTRY_001")
 */
function generateAlgorithmCode(strategyType: number): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  const prefixMap: Record<number, string> = {
    9: 'REG',      // Regime Detector
    10: 'ENTRY',   // Entry Signal
    4: 'PRE',      // Pre-condition
    6: 'POST',     // Post-condition
    0: 'STEP',     // Select Steps
    1: 'STEP',
    2: 'STEP',
    3: 'STEP',
  };

  const prefix = prefixMap[strategyType] || 'ALG';
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Map generation config to database save format
 *
 * @param config - Generation configuration
 * @returns Algorithm save data
 */
function mapConfigToSaveData(config: AlgorithmGenerationConfig): AlgorithmSaveData {
  return {
    code: generateAlgorithmCode(config.strategy_type),
    strategy_name: config.strategy_name,
    strategy_type: config.strategy_type,
    classification_metadata: JSON.stringify(config.metadata),
    strategy_rules: config.rules ? JSON.stringify(config.rules) : undefined,
    description: config.description,
    user_id: config.user_id || 'default',
    file_path: undefined, // Optional: could be populated later
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Save generated algorithm to database via Hub API
 *
 * This function provides a unified interface for saving algorithms
 * across all plugin pages. It handles:
 * - Generating unique algorithm codes
 * - Mapping configuration to database schema
 * - Calling Hub API with proper plugin context
 * - Error handling and notifications
 *
 * @param config - Algorithm generation configuration
 * @param pluginId - Plugin ID (default: 'com.quantnexus.strategy-builder-nexus')
 * @returns Save result with success/error status
 *
 * @example
 * ```typescript
 * const result = await saveAlgorithm({
 *   strategy_name: 'Trend Following',
 *   strategy_type: 9,
 *   generated_code: pythonCode,
 *   metadata: { regime: 'trend', llm_provider: 'NONA' },
 * });
 *
 * if (result.success) {
 *   console.log('Saved:', result.data);
 * }
 * ```
 */
export async function saveAlgorithm(
  config: AlgorithmGenerationConfig,
  pluginId = 'com.quantnexus.strategy-builder-nexus'
): Promise<AlgorithmSaveResult> {
  try {
    // Map config to database format
    const algorithmData = mapConfigToSaveData(config);

    console.log('[AlgorithmSaveService] Saving algorithm:', {
      code: algorithmData.code,
      name: algorithmData.strategy_name,
      type: algorithmData.strategy_type,
    });

    // Call Hub API to save
    const response = await window.electronAPI.hub.invokeEntity(
      'save',
      'nona_algorithm',
      algorithmData,
      pluginId
    );

    if (response.success) {
      console.log('[AlgorithmSaveService] Algorithm saved successfully:', response.data);

      // Show success notification
      window.nexus?.window?.showNotification(
        `Strategy "${config.strategy_name}" saved successfully`,
        'success'
      );

      return {
        success: true,
        data: response.data,
      };
    } else {
      console.error('[AlgorithmSaveService] Save failed:', response.error);

      // Show error notification
      window.nexus?.window?.showNotification(
        'Failed to save strategy',
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
    console.error('[AlgorithmSaveService] Exception during save:', error);

    // Show error notification
    window.nexus?.window?.showNotification(
      'Failed to save strategy',
      'error'
    );

    return {
      success: false,
      error: {
        code: 'EXCEPTION',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Save algorithm without showing notifications
 *
 * Use this for batch operations or when you want to handle
 * notifications manually.
 *
 * @param config - Algorithm generation configuration
 * @param pluginId - Plugin ID
 * @returns Save result
 */
export async function saveAlgorithmSilent(
  config: AlgorithmGenerationConfig,
  pluginId = 'com.quantnexus.strategy-builder-nexus'
): Promise<AlgorithmSaveResult> {
  try {
    const algorithmData = mapConfigToSaveData(config);

    console.log('[AlgorithmSaveService] Saving algorithm (silent):', {
      code: algorithmData.code,
      name: algorithmData.strategy_name,
      type: algorithmData.strategy_type,
    });

    const response = await window.electronAPI.hub.invokeEntity(
      'save',
      'nona_algorithm',
      algorithmData,
      pluginId
    );

    if (response.success) {
      console.log('[AlgorithmSaveService] Algorithm saved successfully:', response.data);
      return {
        success: true,
        data: response.data,
      };
    } else {
      console.error('[AlgorithmSaveService] Save failed:', response.error);
      return {
        success: false,
        error: response.error || {
          code: 'SAVE_FAILED',
          message: 'Unknown error occurred',
        },
      };
    }
  } catch (error) {
    console.error('[AlgorithmSaveService] Exception during save:', error);
    return {
      success: false,
      error: {
        code: 'EXCEPTION',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

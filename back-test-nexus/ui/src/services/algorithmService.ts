/**
 * Algorithm Service - Plugin Layer
 *
 * Provides typed access to nona_algorithms table via IPC.
 * Follows plugin architecture pattern - all data access through electronAPI.
 *
 * TICKET_168: Uses algorithmCodeRegistry to validate and supplement code fields
 *
 * @see TICKET_077_COMPONENT7 - Data Integration
 * @see TICKET_168 - Centralized Algorithm Code Registry
 */

import { algorithmCodeRegistry } from './algorithmCodeRegistry';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Algorithm {
  id: number;
  code: string;
  strategyName: string;
  strategyType: number;
  description?: string;
}

export interface AlgorithmOption {
  id: number;
  code: string;
  strategyName: string;
  strategyType: number;
  description?: string;
}

interface AlgorithmResponse {
  success: boolean;
  data?: Array<{
    id: number;
    code: string;
    strategy_name: string;
    strategy_type: number;
    description: string | null;
  }>;
  error?: { code: string; message: string };
}

// -----------------------------------------------------------------------------
// Algorithm Service
// -----------------------------------------------------------------------------

export const algorithmService = {
  /**
   * Get Trend-Range algorithms (strategy_type = 9)
   */
  async getTrendRangeAlgorithms(): Promise<Algorithm[]> {
    const response: AlgorithmResponse = await window.electronAPI.database.getAlgorithms({
      userId: 'default', // TODO: Replace with actual user ID when auth is implemented
      strategyType: 9,
    });

    if (!response.success || !response.data) {
      console.error('[algorithmService] Failed to fetch trend-range algorithms:', response.error);
      return [];
    }

    return response.data.map(toAlgorithm);
  },

  /**
   * Get Pre-condition algorithms (strategy_type = 4)
   */
  async getPreConditionAlgorithms(): Promise<Algorithm[]> {
    const response: AlgorithmResponse = await window.electronAPI.database.getAlgorithms({
      userId: 'default',
      strategyType: 4,
    });

    if (!response.success || !response.data) {
      console.error('[algorithmService] Failed to fetch pre-condition algorithms:', response.error);
      return [];
    }

    return response.data.map(toAlgorithm);
  },

  /**
   * Get Select Steps algorithms (strategy_type = 0, 1, 2, 3)
   */
  async getSelectStepsAlgorithms(): Promise<Algorithm[]> {
    const response: AlgorithmResponse = await window.electronAPI.database.getAlgorithms({
      userId: 'default',
      strategyType: [0, 1, 2, 3],
    });

    if (!response.success || !response.data) {
      console.error('[algorithmService] Failed to fetch select-steps algorithms:', response.error);
      return [];
    }

    return response.data.map(toAlgorithm);
  },

  /**
   * Get Post-condition algorithms (strategy_type = 6)
   */
  async getPostConditionAlgorithms(): Promise<Algorithm[]> {
    const response: AlgorithmResponse = await window.electronAPI.database.getAlgorithms({
      userId: 'default',
      strategyType: 6,
    });

    if (!response.success || !response.data) {
      console.error('[algorithmService] Failed to fetch post-condition algorithms:', response.error);
      return [];
    }

    return response.data.map(toAlgorithm);
  },
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Convert database record to Algorithm
 * TICKET_168: Validates and supplements code using algorithmCodeRegistry
 */
function toAlgorithm(record: {
  id: number;
  code: string;
  strategy_name: string;
  strategy_type: number;
  description: string | null;
}): Algorithm {
  // TICKET_168: Use registry to get valid code
  const validCode = algorithmCodeRegistry.getValidCode(record.strategy_name, record.code);

  return {
    id: record.id,
    code: validCode || record.code, // Fallback to db code if registry has nothing
    strategyName: record.strategy_name,
    strategyType: record.strategy_type,
    description: record.description || undefined,
  };
}

/**
 * Convert Algorithm to AlgorithmOption (for WorkflowDropdown)
 */
export function toAlgorithmOption(algo: Algorithm): AlgorithmOption {
  return {
    id: algo.id,
    code: algo.code,
    strategyName: algo.strategyName,
    strategyType: algo.strategyType,
    description: algo.description,
  };
}

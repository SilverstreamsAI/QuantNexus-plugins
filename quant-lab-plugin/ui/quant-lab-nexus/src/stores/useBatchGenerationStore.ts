/**
 * useBatchGenerationStore
 *
 * TICKET_426_2: Layer 2 session store for batch generation config (TICKET_367).
 * Module-level singleton — survives component unmount/remount during view switches.
 * Uses React.useSyncExternalStore for tear-free reads (no zustand dependency needed).
 *
 * LLM provider/model persisted to localStorage per TICKET_419.
 */

import { useSyncExternalStore, useCallback } from 'react';
import type { BatchGenerationStatus } from '../types';

// ============================================================================
// Constants
// ============================================================================

const LLM_STORAGE_KEY = 'quantnexus:batch-gen-llm';
const DEFAULT_LLM_PROVIDER = 'NONA';
const DEFAULT_LLM_MODEL = 'nona-nexus';

// ============================================================================
// Types
// ============================================================================

export interface BatchGenerationProgress {
  completed: number;
  total: number;
  currentName: string;
}

interface BatchGenerationState {
  preference: string;
  regime: string;
  indicators: string[];
  quantity: number;
  persona: string | null;
  llmProvider: string;
  llmModel: string;
  status: BatchGenerationStatus;
  progress: BatchGenerationProgress;
  error: string | null;
}

// ============================================================================
// localStorage helpers (TICKET_419)
// ============================================================================

function loadPersistedLlm(): { provider: string; model: string } {
  try {
    const raw = localStorage.getItem(LLM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || DEFAULT_LLM_PROVIDER,
        model: parsed.model || DEFAULT_LLM_MODEL,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL };
}

function persistLlm(provider: string, model: string): void {
  try {
    localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify({ provider, model }));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Module-level singleton store (Layer 2: survives unmount)
// ============================================================================

const DEFAULT_PROGRESS: BatchGenerationProgress = { completed: 0, total: 0, currentName: '' };

const initialLlm = loadPersistedLlm();

let state: BatchGenerationState = {
  preference: '',
  regime: 'trend',
  indicators: [],
  quantity: 5,
  persona: null,
  llmProvider: initialLlm.provider,
  llmModel: initialLlm.model,
  status: 'idle',
  progress: DEFAULT_PROGRESS,
  error: null,
};

const listeners = new Set<() => void>();

function getSnapshot(): BatchGenerationState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(partial: Partial<BatchGenerationState>): void {
  state = { ...state, ...partial };
  listeners.forEach(l => l());
}

// ============================================================================
// Hook
// ============================================================================

export function useBatchGenerationStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setPreference = useCallback((value: string) => setState({ preference: value }), []);
  const setRegime = useCallback((value: string) => setState({ regime: value }), []);
  const setIndicators = useCallback((value: string[]) => setState({ indicators: value }), []);
  const setQuantity = useCallback((value: number) => setState({ quantity: value }), []);
  const setPersona = useCallback((value: string | null) => setState({ persona: value }), []);

  const setLlmProvider = useCallback((value: string) => {
    setState({ llmProvider: value });
    persistLlm(value, state.llmModel);
  }, []);

  const setLlmModel = useCallback((value: string) => {
    setState({ llmModel: value });
    persistLlm(state.llmProvider, value);
  }, []);

  const setStatus = useCallback((value: BatchGenerationStatus) => setState({ status: value }), []);
  const setProgress = useCallback((value: BatchGenerationProgress) => setState({ progress: value }), []);
  const setError = useCallback((value: string | null) => setState({ error: value }), []);

  const reset = useCallback(() => {
    const llm = loadPersistedLlm();
    setState({
      preference: '',
      regime: 'trend',
      indicators: [],
      quantity: 5,
      persona: null,
      llmProvider: llm.provider,
      llmModel: llm.model,
      status: 'idle',
      progress: DEFAULT_PROGRESS,
      error: null,
    });
  }, []);

  return {
    ...snap,
    setPreference,
    setRegime,
    setIndicators,
    setQuantity,
    setPersona,
    setLlmProvider,
    setLlmModel,
    setStatus,
    setProgress,
    setError,
    reset,
  };
}

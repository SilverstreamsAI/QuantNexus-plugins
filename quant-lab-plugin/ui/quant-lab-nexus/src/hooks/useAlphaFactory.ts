/**
 * useAlphaFactory Hook
 *
 * TICKET_250_11: React hook for Alpha Factory execution
 */

import { useState, useCallback, useEffect } from 'react';

interface AlphaFactoryResult {
  signalCount: number;
  barCount: number;
  executionTimeMs: number;
  signals: number[];
  signalNames: string[];
}

interface UseAlphaFactoryReturn {
  execute: (config: Record<string, unknown>) => Promise<void>;
  cancel: () => Promise<void>;
  isRunning: boolean;
  progress: number;
  result: AlphaFactoryResult | null;
  error: string | null;
}

export function useAlphaFactory(): UseAlphaFactoryReturn {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AlphaFactoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execute Alpha Factory
  const execute = useCallback(async (config: Record<string, unknown>) => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      // Call IPC handler
      const response = await (window as any).electron?.invoke('executor-plugin:execute', {
        pluginName: 'alpha-factory',
        config,
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Execution failed');
      }

      setTaskId(response.taskId);

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsRunning(false);
    }
  }, []);

  // Cancel execution
  const cancel = useCallback(async () => {
    if (!taskId) return;

    try {
      await (window as any).electron?.invoke('executor-plugin:cancel', taskId);
      setIsRunning(false);
      setError('Execution cancelled');
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  }, [taskId]);

  // Poll for progress
  useEffect(() => {
    if (!taskId || !isRunning) return;

    const interval = setInterval(async () => {
      try {
        const response = await (window as any).electron?.invoke('executor-plugin:progress', taskId);

        if (response?.success) {
          setProgress(response.progress || 0);

          if (response.status === 'completed') {
            setIsRunning(false);
            clearInterval(interval);

            // Get result
            const resultResponse = await (window as any).electron?.invoke('executor-plugin:result', taskId);
            if (resultResponse?.success && resultResponse.result) {
              setResult(resultResponse.result.data);
            }
          } else if (response.status === 'failed') {
            setIsRunning(false);
            setError(response.error || 'Execution failed');
            clearInterval(interval);
          } else if (response.status === 'cancelled') {
            setIsRunning(false);
            setError('Execution cancelled');
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to get progress:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [taskId, isRunning]);

  return {
    execute,
    cancel,
    isRunning,
    progress,
    result,
    error,
  };
}

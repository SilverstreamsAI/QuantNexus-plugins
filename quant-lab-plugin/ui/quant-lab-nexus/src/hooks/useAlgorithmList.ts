/**
 * useAlgorithmList Hook
 *
 * TICKET_426_1: Fetches algorithm list from nona_algorithms via IPC.
 * Pattern follows usePersonaList.ts.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlgorithmBrowserItem } from '../types';

interface UseAlgorithmListReturn {
  algorithms: AlgorithmBrowserItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAlgorithmList(): UseAlgorithmListReturn {
  const [algorithms, setAlgorithms] = useState<AlgorithmBrowserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.algorithm?.list) {
      setAlgorithms([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.algorithm.list({ userId: 'default' });
      if (response.success && response.data) {
        setAlgorithms(response.data as AlgorithmBrowserItem[]);
      } else {
        setAlgorithms([]);
        if (response.error) {
          setError(typeof response.error === 'string' ? response.error : String(response.error));
        }
      }
    } catch (err) {
      setAlgorithms([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { algorithms, isLoading, error, refresh };
}

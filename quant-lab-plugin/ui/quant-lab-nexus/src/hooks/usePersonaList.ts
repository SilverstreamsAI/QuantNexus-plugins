/**
 * usePersonaList Hook
 *
 * TICKET_426_3: Fetches persona list from backend via IPC.
 * Read-only reference data, cached in component state.
 */

import { useState, useEffect, useCallback } from 'react';
import { PersonaItem } from '../types';

interface UsePersonaListReturn {
  personas: PersonaItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePersonaList(): UsePersonaListReturn {
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.persona?.list) {
      setPersonas([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.persona.list();
      if (response.success && response.data) {
        setPersonas(response.data as PersonaItem[]);
      } else {
        setPersonas([]);
        if (response.error) {
          setError(response.error);
        }
      }
    } catch (err) {
      setPersonas([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { personas, isLoading, error, refresh };
}

/**
 * Quant Lab Plugin Availability Hook
 *
 * TICKET_264: Plugin detection for conditional UI rendering
 *
 * Check if Quant Lab plugin is installed to conditionally show/hide
 * the "Export to Quant Lab" button in Strategy Builder pages.
 */

import { useState, useEffect } from 'react';

// Plugin ID for Quant Lab
const QUANT_LAB_PLUGIN_ID = 'quant-lab-plugin';

/**
 * Hook return type
 */
export interface UseQuantLabAvailableReturn {
  /** Whether Quant Lab plugin is installed */
  isAvailable: boolean;
  /** Whether the check is still loading */
  isLoading: boolean;
  /** Error message if check failed */
  error: string | null;
  /** Refresh the availability check */
  refresh: () => void;
}

/**
 * Check if Quant Lab plugin is available
 *
 * @returns Availability state and refresh function
 *
 * @example
 * ```tsx
 * const { isAvailable, isLoading } = useQuantLabAvailable();
 *
 * if (isLoading) return <Spinner />;
 *
 * return (
 *   <>
 *     <GenerateButton />
 *     {isAvailable && <ExportToQuantLabButton />}
 *   </>
 * );
 * ```
 */
export function useQuantLabAvailable(): UseQuantLabAvailableReturn {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Access the preload API (exposed as electronAPI, not quantnexus)
      const api = (window as any).electronAPI;
      if (!api?.plugin?.isInstalled) {
        // API not available (should not happen in normal operation)
        setIsAvailable(false);
        setError('Plugin API not available');
        return;
      }

      const result = await api.plugin.isInstalled(QUANT_LAB_PLUGIN_ID);

      if (result.success) {
        setIsAvailable(result.installed);
      } else {
        setIsAvailable(false);
        setError(result.error || 'Failed to check plugin availability');
      }
    } catch (err) {
      setIsAvailable(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAvailability();
  }, []);

  return {
    isAvailable,
    isLoading,
    error,
    refresh: checkAvailability,
  };
}

/**
 * Global type declarations for Electron API
 */

declare global {
  interface Window {
    electronAPI: {
      database: {
        getAlgorithms: (params: {
          userId: string;
          strategyType: number | number[];
        }) => Promise<{
          success: boolean;
          data?: any[];
          error?: { code: string; message: string };
        }>;
      };
    };
  }
}

export {};

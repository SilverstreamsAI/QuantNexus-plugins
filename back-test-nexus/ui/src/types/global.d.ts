/**
 * Global type declarations for Electron API
 * TICKET_136: Added data API types
 */

interface DataEnsureConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
  provider?: string;
  forceDownload?: boolean;
  callerId?: string;
}

interface DataEnsureResult {
  success: boolean;
  symbol: string;
  dataType?: 'forex' | 'stock' | 'crypto';
  coverage?: {
    symbol: string;
    interval: string;
    startDate: string;
    endDate: string;
    totalBars: number;
    completeness: number;
  };
  source?: string;
  dataPath?: string;
  error?: string;
}

interface DataCoverageConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
}

interface DataCoverageResult {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  totalBars: number;
  completeness: number;
  missingRanges?: Array<{ start: string; end: string }>;
  error?: string;
}

interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: 'forex' | 'stock' | 'crypto';
  status: string;
}

interface ConnectionCheckResult {
  provider: string;
  connected: boolean;
  latencyMs?: number;
  lastCheck: string;
  error?: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: 'FREE' | 'PRO' | 'ENT';
}

interface AuthStateData {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

declare global {
  interface Window {
    electronAPI: {
      database: {
        getAlgorithms: (params: {
          userId: string;
          strategyType: number | number[];
          signalSourcePrefix?: string;
        }) => Promise<{
          success: boolean;
          data?: any[];
          error?: { code: string; message: string };
        }>;
      };
      data: {
        ensure: (config: DataEnsureConfig) => Promise<DataEnsureResult>;
        checkCoverage: (config: DataCoverageConfig) => Promise<DataCoverageResult>;
        searchSymbols: (query: string) => Promise<SymbolSearchResult[]>;
        checkConnection: (provider: string) => Promise<ConnectionCheckResult>;
        onProgress: (callback: (event: unknown, data: unknown) => void) => () => void;
        cancelDownload: () => void;
      };
      auth: {
        getState: () => Promise<{
          success: boolean;
          data?: AuthStateData;
          error?: string;
        }>;
        onStateChanged: (callback: (data: AuthStateData) => void) => () => void;
      };
    };
  }
}

export {};

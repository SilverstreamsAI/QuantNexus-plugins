/**
 * Data Source Nexus - UI Module Entry Point
 *
 * This is the browser-compatible entry point for the Data Source Nexus plugin.
 * It registers providers with the Host's windowApi and delegates data operations
 * to the backend via IPC.
 *
 * @see TICKET_061 - Data Nexus Architecture Refactor
 */

import type {
  PluginModule,
  PluginContext,
  PluginApi,
  Disposable,
} from '@shared/types';
import { DataTreeDataProvider } from './providers/DataTreeDataProvider';
import type { DataNode } from './types';

// =============================================================================
// Types
// =============================================================================

interface ElectronDataAPI {
  refresh?: () => Promise<void>;
  clearCache?: () => Promise<void>;
  fetchHistorical?: (req: unknown) => Promise<unknown>;
  getQuote?: (symbol: string) => Promise<unknown>;
  searchSymbols?: (query: string) => Promise<unknown>;
  setActiveProvider?: (id: string) => Promise<void>;
}

interface ElectronAPI {
  data?: ElectronDataAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// =============================================================================
// Plugin State
// =============================================================================

const disposables: Disposable[] = [];
let treeProvider: DataTreeDataProvider | null = null;

// =============================================================================
// Helper Functions
// =============================================================================

function getDataAPI(): ElectronDataAPI | undefined {
  return window.electronAPI?.data;
}

// =============================================================================
// Plugin Module
// =============================================================================

const plugin: PluginModule = {
  async activate(context: PluginContext): Promise<PluginApi> {
    context.log.info('Data Source Nexus (UI) activating...');

    // Access windowApi from global (injected by host)
    const windowApi = (globalThis as { nexus?: { window: unknown } }).nexus?.window;

    if (!windowApi) {
      context.log.error('windowApi not available - plugin cannot register providers');
      throw new Error('windowApi not available');
    }

    const api = windowApi as {
      registerTreeDataProvider: (viewId: string, provider: unknown) => Disposable;
      registerViewProvider: (viewId: string, provider: unknown) => Disposable;
      setBreadcrumb: (items: unknown[]) => void;
      openView: (viewId: string, options?: unknown) => Promise<void>;
    };

    // -------------------------------------------------------------------------
    // Register Tree Data Provider
    // -------------------------------------------------------------------------

    treeProvider = new DataTreeDataProvider();
    disposables.push(
      api.registerTreeDataProvider('data.tree', treeProvider)
    );
    context.log.info('DataTreeDataProvider registered');

    // -------------------------------------------------------------------------
    // Register Commands
    // -------------------------------------------------------------------------

    // Command: data.selectNode - Handle tree node selection
    context.commands.register('data.selectNode', (...args: unknown[]) => {
      const node = args[0] as DataNode;
      if (!node) return;

      context.log.debug(`Node selected: ${node.id} (${node.type})`);

      // Build breadcrumb path
      const breadcrumb: { id: string; label: string }[] = [
        { id: 'data', label: 'DATA CONFIGURATION' },
      ];
      if (node.type !== 'root') {
        breadcrumb.push({ id: node.id, label: node.label });
      }
      api.setBreadcrumb(breadcrumb);

      // Open appropriate view based on node type
      switch (node.type) {
        case 'root':
          if (node.id === 'providers-root') {
            api.openView('data.sourceSelector');
          } else {
            api.openView('data.symbolSearch');
          }
          break;
        case 'provider':
          api.openView('data.connectionStatus', { providerId: node.metadata?.providerId });
          break;
        case 'symbol':
          api.openView('data.rangePanel', { symbol: node.metadata?.symbol });
          break;
        case 'interval':
          api.openView('data.rangePanel', {
            symbol: node.metadata?.symbol,
            interval: node.metadata?.interval,
          });
          break;
      }
    });

    // Command: data.refresh - Refresh tree data
    context.commands.register('data.refresh', async () => {
      context.log.info('Refreshing data tree...');
      treeProvider?.refresh();

      // Also trigger backend cache refresh via IPC
      try {
        const dataApi = getDataAPI();
        await dataApi?.refresh?.();
        context.ui.showNotification('Data refreshed', 'success');
      } catch (error) {
        context.log.error('Failed to refresh data:', error);
        context.ui.showNotification('Failed to refresh data', 'error');
      }
    });

    // Command: data.clearCache - Clear local cache
    context.commands.register('data.clearCache', async () => {
      context.log.info('Clearing cache...');
      try {
        const dataApi = getDataAPI();
        await dataApi?.clearCache?.();
        treeProvider?.refresh();
        context.ui.showNotification('Cache cleared', 'success');
      } catch (error) {
        context.log.error('Failed to clear cache:', error);
        context.ui.showNotification('Failed to clear cache', 'error');
      }
    });

    // Command: data.fetchHistorical - Fetch historical data
    context.commands.register('data.fetchHistorical', async (...args: unknown[]) => {
      const request = args[0] as {
        symbol: string;
        interval: string;
        start?: string | number;
        end?: string | number;
      };
      if (!request) return null;

      context.log.info(`Fetching historical data: ${request.symbol} ${request.interval}`);
      try {
        const dataApi = getDataAPI();
        const result = await dataApi?.fetchHistorical?.(request);
        return result;
      } catch (error) {
        context.log.error('Failed to fetch historical data:', error);
        throw error;
      }
    });

    // Command: data.getQuote - Get current quote
    context.commands.register('data.getQuote', async (...args: unknown[]) => {
      const symbol = args[0] as string;
      if (!symbol) return null;

      try {
        const dataApi = getDataAPI();
        return await dataApi?.getQuote?.(symbol);
      } catch (error) {
        context.log.error(`Failed to get quote for ${symbol}:`, error);
        throw error;
      }
    });

    // Command: data.searchSymbols - Search symbols
    context.commands.register('data.searchSymbols', async (...args: unknown[]) => {
      const query = args[0] as string;
      if (!query) return [];

      try {
        const dataApi = getDataAPI();
        return await dataApi?.searchSymbols?.(query);
      } catch (error) {
        context.log.error(`Failed to search symbols: ${query}`, error);
        throw error;
      }
    });

    // Command: data.setActiveProvider - Set active data provider
    context.commands.register('data.setActiveProvider', async (...args: unknown[]) => {
      const providerId = args[0] as string;
      if (!providerId) return;

      context.log.info(`Setting active provider: ${providerId}`);
      try {
        const dataApi = getDataAPI();
        await dataApi?.setActiveProvider?.(providerId);
        treeProvider?.updateProviderStatus(providerId, 'connected');
        context.ui.showNotification(`Provider set to: ${providerId}`, 'success');
      } catch (error) {
        context.log.error(`Failed to set provider: ${providerId}`, error);
        context.ui.showNotification('Failed to set provider', 'error');
      }
    });

    context.log.info('Data Source Nexus (UI) activated successfully');

    // Return plugin API
    return {
      activate: async () => {},
      deactivate: async () => {},
    };
  },

  async deactivate(): Promise<void> {
    // Dispose all registered providers
    for (const disposable of disposables) {
      disposable.dispose();
    }
    disposables.length = 0;
    treeProvider = null;

    console.info('[Data Source Nexus] UI module deactivated');
  },
};

export default plugin;

// Re-export types
export * from './types';
export { DataTreeDataProvider } from './providers/DataTreeDataProvider';

// Export tree provider accessor for external use
export function getTreeProvider(): DataTreeDataProvider | null {
  return treeProvider;
}

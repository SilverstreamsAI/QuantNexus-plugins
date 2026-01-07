/**
 * DataTreeDataProvider
 *
 * Provides tree data for the data explorer sidebar.
 * Communicates with backend via IPC to fetch actual data.
 */

import type {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Disposable,
} from '@shared/types';
import type { DataNode } from '../types';

// TreeItemCollapsibleState values
const CollapsibleState = {
  None: 0 as TreeItemCollapsibleState,
  Collapsed: 1 as TreeItemCollapsibleState,
  Expanded: 2 as TreeItemCollapsibleState,
};

// =============================================================================
// DataTreeDataProvider Implementation
// =============================================================================

export class DataTreeDataProvider implements TreeDataProvider<DataNode> {
  private nodeMap = new Map<string, DataNode>();
  private changeListeners = new Set<(node: DataNode | undefined) => void>();
  private rootNodes: DataNode[] = [];

  constructor() {
    // Initialize with default structure, will be populated via IPC
    this.initializeDefaultStructure();
  }

  // ===========================================================================
  // TreeDataProvider Interface
  // ===========================================================================

  onDidChangeTreeData = (
    listener: (node: DataNode | undefined) => void
  ): Disposable => {
    this.changeListeners.add(listener);
    return {
      dispose: () => {
        this.changeListeners.delete(listener);
      },
    };
  };

  getTreeItem(element: DataNode): TreeItem {
    const hasChildren = element.children && element.children.length > 0;
    const isExpandable = element.type === 'root' || element.type === 'symbol';

    let collapsibleState: TreeItemCollapsibleState;
    if (!hasChildren) {
      collapsibleState = CollapsibleState.None;
    } else if (isExpandable) {
      collapsibleState = CollapsibleState.Expanded;
    } else {
      collapsibleState = CollapsibleState.Collapsed;
    }

    return {
      id: element.id,
      label: element.label,
      description: element.status?.toUpperCase(),
      tooltip: `${element.label}${element.status ? ` - ${element.status}` : ''}`,
      collapsibleState,
      command: {
        command: 'data.selectNode',
        title: 'Select Node',
        arguments: [element],
      },
      contextValue: element.type,
    };
  }

  getChildren(element?: DataNode | { id: string }): DataNode[] {
    if (!element) {
      return this.rootNodes;
    }

    // If element is a TreeItem (has id but no children), look up the original node
    const node = this.nodeMap.get(element.id);
    if (!node) {
      return [];
    }

    return node.children || [];
  }

  getParent(element: DataNode): DataNode | undefined {
    if (!element.parentId) return undefined;
    return this.nodeMap.get(element.parentId);
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Refresh the tree data
   */
  refresh(node?: DataNode): void {
    // Reload data from backend via IPC
    this.loadDataFromBackend().then(() => {
      for (const listener of this.changeListeners) {
        listener(node);
      }
    });
  }

  /**
   * Update provider status
   */
  updateProviderStatus(providerId: string, status: 'connected' | 'disconnected'): void {
    const node = this.nodeMap.get(`provider-${providerId}`);
    if (node) {
      node.status = status;
      this.notifyChange(node);
    }
  }

  /**
   * Add a symbol to the cached symbols list
   */
  addCachedSymbol(symbol: string, intervals: string[]): void {
    const symbolsRoot = this.nodeMap.get('symbols-root');
    if (!symbolsRoot) return;

    const symbolId = `symbol-${symbol.toLowerCase()}`;

    // Check if symbol already exists
    if (this.nodeMap.has(symbolId)) return;

    const symbolNode: DataNode = {
      id: symbolId,
      label: symbol,
      type: 'symbol',
      status: 'available',
      parentId: 'symbols-root',
      metadata: { symbol },
      children: intervals.map(interval => ({
        id: `interval-${symbol.toLowerCase()}-${interval}`,
        label: interval.toUpperCase(),
        type: 'interval' as const,
        status: 'available' as const,
        parentId: symbolId,
        metadata: { symbol, interval },
      })),
    };

    // Add to tree
    if (!symbolsRoot.children) {
      symbolsRoot.children = [];
    }
    symbolsRoot.children.push(symbolNode);
    this.buildNodeMap([symbolNode]);

    this.notifyChange();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private initializeDefaultStructure(): void {
    this.rootNodes = [
      {
        id: 'providers-root',
        label: 'DATA PROVIDERS',
        type: 'root',
        children: [
          {
            id: 'provider-clickhouse',
            label: 'ClickHouse',
            type: 'provider',
            status: 'disconnected',
            parentId: 'providers-root',
            metadata: { providerId: 'clickhouse' },
          },
          {
            id: 'provider-local',
            label: 'Local Cache',
            type: 'provider',
            status: 'connected',
            parentId: 'providers-root',
            metadata: { providerId: 'local' },
          },
        ],
      },
      {
        id: 'symbols-root',
        label: 'CACHED SYMBOLS',
        type: 'root',
        children: [],
      },
    ];

    this.buildNodeMap(this.rootNodes);
  }

  private buildNodeMap(nodes: DataNode[]): void {
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
      if (node.children) {
        this.buildNodeMap(node.children);
      }
    }
  }

  private notifyChange(node?: DataNode): void {
    for (const listener of this.changeListeners) {
      listener(node);
    }
  }

  /**
   * Load data from backend via IPC
   */
  private async loadDataFromBackend(): Promise<void> {
    try {
      // Check if IPC API is available
      const dataApi = (window as any).electronAPI?.data;
      if (!dataApi) {
        console.debug('[DataTreeDataProvider] IPC data API not available yet');
        return;
      }

      // Get provider statuses
      const providers = await dataApi.getProviders?.();
      if (providers) {
        this.updateProvidersFromBackend(providers);
      }

      // Get cached symbols
      const symbols = await dataApi.getCachedSymbols?.();
      if (symbols) {
        this.updateSymbolsFromBackend(symbols);
      }
    } catch (error) {
      console.error('[DataTreeDataProvider] Failed to load from backend:', error);
    }
  }

  private updateProvidersFromBackend(providers: Array<{
    id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'error';
  }>): void {
    const providersRoot = this.nodeMap.get('providers-root');
    if (!providersRoot) return;

    providersRoot.children = providers.map(p => ({
      id: `provider-${p.id}`,
      label: p.name,
      type: 'provider' as const,
      status: p.status === 'connected' ? 'connected' as const : 'disconnected' as const,
      parentId: 'providers-root',
      metadata: { providerId: p.id },
    }));

    this.buildNodeMap(providersRoot.children);
  }

  private updateSymbolsFromBackend(symbols: Array<{
    symbol: string;
    intervals: string[];
  }>): void {
    const symbolsRoot = this.nodeMap.get('symbols-root');
    if (!symbolsRoot) return;

    symbolsRoot.children = symbols.map(s => {
      const symbolId = `symbol-${s.symbol.toLowerCase()}`;
      return {
        id: symbolId,
        label: s.symbol,
        type: 'symbol' as const,
        status: 'available' as const,
        parentId: 'symbols-root',
        metadata: { symbol: s.symbol },
        children: s.intervals.map(interval => ({
          id: `interval-${s.symbol.toLowerCase()}-${interval}`,
          label: interval.toUpperCase(),
          type: 'interval' as const,
          status: 'available' as const,
          parentId: symbolId,
          metadata: { symbol: s.symbol, interval },
        })),
      };
    });

    this.buildNodeMap(symbolsRoot.children);
  }
}

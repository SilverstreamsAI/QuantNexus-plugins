/**
 * StrategyTreeDataProvider - Provides tree data for the strategy explorer
 *
 * This provider implements TreeDataProvider to provide hierarchical strategy data
 * to the Host's TreeViewContainer.
 *
 * @see TICKET_059 - Host/Plugin Architecture
 */

import type {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Disposable,
} from '@shared/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface StrategyNode {
  id: string;
  label: string;
  type: 'hub' | 'provider' | 'group' | 'generator';
  status?: 'running' | 'warning' | 'error' | 'idle';
  children?: StrategyNode[];
  level: number;
  parentId?: string;
  resourceUri?: string;
}

// TreeItemCollapsibleState values
const CollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
} as const;

// -----------------------------------------------------------------------------
// Mock Data (to be replaced with real data source)
// -----------------------------------------------------------------------------

const mockTreeData: StrategyNode[] = [
  {
    id: 'hub',
    label: 'GLOBAL DASHBOARD',
    type: 'hub',
    level: 1,
    children: [],
  },
  {
    id: 'provider-nona',
    label: 'Nona',
    type: 'provider',
    level: 2,
    children: [
      {
        id: 'group-trend',
        label: 'TREND FOLLOWING',
        type: 'group',
        level: 3,
        parentId: 'provider-nona',
        children: [
          {
            id: 'gen-001',
            label: 'REGIME TREND X1',
            type: 'generator',
            status: 'running',
            level: 4,
            parentId: 'group-trend',
            resourceUri: 'strategy://gen-001',
          },
          {
            id: 'gen-002',
            label: 'VOL-ADAPTIVE BETA',
            type: 'generator',
            status: 'idle',
            level: 4,
            parentId: 'group-trend',
            resourceUri: 'strategy://gen-002',
          },
        ],
      },
      {
        id: 'group-mean',
        label: 'MEAN REVERSION',
        type: 'group',
        level: 3,
        parentId: 'provider-nona',
        children: [
          {
            id: 'gen-003',
            label: 'CROSS-SESS ARBI',
            type: 'generator',
            status: 'running',
            level: 4,
            parentId: 'group-mean',
            resourceUri: 'strategy://gen-003',
          },
        ],
      },
    ],
  },
  {
    id: 'provider-aaa',
    label: 'AAA QUANT TOOLS',
    type: 'provider',
    level: 2,
    children: [],
  },
];

// -----------------------------------------------------------------------------
// StrategyTreeDataProvider
// -----------------------------------------------------------------------------

type ChangeListener = (node: StrategyNode | undefined) => void;

export class StrategyTreeDataProvider implements TreeDataProvider<StrategyNode> {
  private changeListeners = new Set<ChangeListener>();
  private nodeMap = new Map<string, StrategyNode>();

  constructor() {
    // Build node map for quick lookup
    this.buildNodeMap(mockTreeData);
  }

  // Event: onDidChangeTreeData
  onDidChangeTreeData = (listener: ChangeListener): Disposable => {
    this.changeListeners.add(listener);
    return {
      dispose: () => {
        this.changeListeners.delete(listener);
      },
    };
  };

  /**
   * Get tree item representation for a node
   */
  getTreeItem(element: StrategyNode): TreeItem {
    const hasChildren = element.children && element.children.length > 0;
    const isHubOrProvider = element.type === 'hub' || element.type === 'provider';

    let collapsibleState: TreeItemCollapsibleState;
    if (!hasChildren && element.type !== 'hub') {
      collapsibleState = CollapsibleState.None;
    } else if (isHubOrProvider) {
      collapsibleState = CollapsibleState.Expanded;
    } else {
      collapsibleState = CollapsibleState.Collapsed;
    }

    return {
      id: element.id,
      label: element.label,
      description: this.getDescription(element),
      tooltip: this.getTooltip(element),
      iconPath: this.getIconPath(element),
      collapsibleState,
      command: {
        command: 'strategy.selectNode',
        title: 'Select Node',
        arguments: [element],
      },
      contextValue: element.type,
    };
  }

  /**
   * Get children of a node
   */
  getChildren(element?: StrategyNode): StrategyNode[] {
    if (!element) {
      // Root level: return top-level nodes
      return mockTreeData;
    }
    return element.children || [];
  }

  /**
   * Get parent of a node
   */
  getParent(element: StrategyNode): StrategyNode | undefined {
    if (!element.parentId) return undefined;
    return this.nodeMap.get(element.parentId);
  }

  /**
   * Refresh the tree
   */
  refresh(node?: StrategyNode): void {
    for (const listener of this.changeListeners) {
      try {
        listener(node);
      } catch (error) {
        console.error('[StrategyTreeDataProvider] Refresh listener error:', error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private buildNodeMap(nodes: StrategyNode[]): void {
    for (const node of nodes) {
      this.nodeMap.set(node.id, node);
      if (node.children) {
        this.buildNodeMap(node.children);
      }
    }
  }

  private getDescription(node: StrategyNode): string | undefined {
    if (node.status) {
      return node.status.toUpperCase();
    }
    return undefined;
  }

  private getTooltip(node: StrategyNode): string {
    const parts = [node.label];
    if (node.status) {
      parts.push(`Status: ${node.status}`);
    }
    return parts.join('\n');
  }

  private getIconPath(node: StrategyNode): string | undefined {
    // Icon paths relative to plugin resources
    const iconMap: Record<string, string> = {
      hub: 'resources/icons/hub.svg',
      provider: 'resources/icons/provider.svg',
      group: 'resources/icons/group.svg',
      generator: 'resources/icons/generator.svg',
    };
    return iconMap[node.type];
  }
}

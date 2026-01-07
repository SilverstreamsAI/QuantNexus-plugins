import type { TreeDataProvider, TreeItem, EventEmitter, Disposable } from '@shared/types';

export class BacktestTreeDataProvider implements TreeDataProvider<any> {
  private _onDidChangeTreeData: EventEmitter<any | undefined> | undefined;

  constructor() {
    // EventEmitter would normally be provided by the host or a library
  }

  getTreeItem(element: any): TreeItem {
    return element;
  }

  async getChildren(element?: any): Promise<any[]> {
    if (!element) {
      // Root items
      return [
        {
          id: 'backtest.workflow',
          label: 'BACKTEST WORKFLOW',
          collapsibleState: 0, // None
          contextValue: 'workflow',
          command: {
            command: 'backtest.openWorkflow',
            title: 'Open Workflow',
          }
        },
        {
          id: 'backtest.history-root',
          label: 'HISTORY',
          collapsibleState: 1, // Collapsed
          contextValue: 'history-root',
        }
      ];
    }

    if (element.id === 'backtest.history-root') {
      // Return mock history items for now
      return [
        {
          id: 'result-1',
          label: 'Backtest Result #1',
          collapsibleState: 0,
          contextValue: 'result',
        },
        {
          id: 'result-2',
          label: 'Backtest Result #2',
          collapsibleState: 0,
          contextValue: 'result',
        }
      ];
    }

    return [];
  }

  refresh(): void {
    // Trigger refresh event
  }
}

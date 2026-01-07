/**
 * Strategy Plugin - Extension Entry Point
 *
 * This is the main entry point for the Strategy Studio plugin.
 * It registers all providers and handles plugin lifecycle.
 *
 * @see TICKET_059 - Host/Plugin Architecture
 */

import type { PluginContext, PluginApi, Disposable } from '@shared/types';
import { StrategyTreeDataProvider } from './providers/StrategyTreeDataProvider';
import { StrategyHubProvider } from './providers/StrategyHubProvider';
import { ProviderPortalProvider } from './providers/ProviderPortalProvider';
import { GroupListProvider } from './providers/GroupListProvider';
import { RegimeEditorProvider } from './providers/RegimeEditorProvider';

// Store disposables for cleanup
const disposables: Disposable[] = [];

// Store provider instances for inter-provider communication
let treeProvider: StrategyTreeDataProvider | null = null;

/**
 * Activate the plugin
 */
export async function activate(context: PluginContext): Promise<PluginApi> {
  context.log.info('Strategy Plugin activating...');

  // Access windowApi from global (injected by host)
  const windowApi = (globalThis as { nexus?: { window: unknown } }).nexus?.window;

  if (!windowApi) {
    context.log.error('windowApi not available - plugin cannot register providers');
    throw new Error('windowApi not available');
  }

  const api = windowApi as {
    registerTreeDataProvider: (viewId: string, provider: unknown) => Disposable;
    registerViewProvider: (viewId: string, provider: unknown) => Disposable;
    registerCustomEditorProvider: (viewType: string, provider: unknown) => Disposable;
    setBreadcrumb: (items: unknown[]) => void;
    openView: (viewId: string, options?: unknown) => Promise<void>;
    openEditor: (resourceUri: string, viewType: string) => Promise<void>;
  };

  // ---------------------------------------------------------------------------
  // Register Tree Data Provider
  // ---------------------------------------------------------------------------

  treeProvider = new StrategyTreeDataProvider();
  disposables.push(
    api.registerTreeDataProvider('strategy.tree', treeProvider)
  );
  context.log.info('StrategyTreeDataProvider registered');

  // ---------------------------------------------------------------------------
  // Register View Providers
  // ---------------------------------------------------------------------------

  const hubProvider = new StrategyHubProvider();
  disposables.push(api.registerViewProvider('strategy.hub', hubProvider));
  context.log.info('StrategyHubProvider registered');

  const portalProvider = new ProviderPortalProvider();
  disposables.push(api.registerViewProvider('strategy.providerPortal', portalProvider));
  context.log.info('ProviderPortalProvider registered');

  const groupListProvider = new GroupListProvider();
  disposables.push(api.registerViewProvider('strategy.groupList', groupListProvider));
  context.log.info('GroupListProvider registered');

  // ---------------------------------------------------------------------------
  // Register Custom Editor Provider
  // ---------------------------------------------------------------------------

  const regimeEditorProvider = new RegimeEditorProvider();
  disposables.push(
    api.registerCustomEditorProvider('strategy.regimeEditor', regimeEditorProvider)
  );
  context.log.info('RegimeEditorProvider registered');

  // ---------------------------------------------------------------------------
  // Register Commands
  // ---------------------------------------------------------------------------

  // Command: Open Hub
  context.commands.register('strategy.openHub', () => {
    api.setBreadcrumb([{ id: 'hub', label: 'STRATEGY HUB' }]);
    api.openView('strategy.hub');
  });

  // Command: Select Node (called from tree item click)
  context.commands.register('strategy.selectNode', (node: any) => {
    handleNodeSelect(node as StrategyNode, api);
  });

  // Command: Refresh Tree
  context.commands.register('strategy.refresh', () => {
    treeProvider?.refresh();
  });

  context.log.info('Strategy Plugin activated successfully');

  return {
    activate: async () => {},
    deactivate: async () => {},
  };
}

/**
 * Deactivate the plugin
 */
export async function deactivate(): Promise<void> {
  // Dispose all registered providers
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
  treeProvider = null;

  console.info('[Strategy Plugin] Deactivated');
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

interface StrategyNode {
  id: string;
  label: string;
  level: number;
  type: 'hub' | 'provider' | 'group' | 'generator';
  resourceUri?: string;
}

type WindowApiType = {
  setBreadcrumb: (items: { id: string; label: string }[]) => void;
  openView: (viewId: string, options?: Record<string, unknown>) => Promise<void>;
  openEditor: (resourceUri: string, viewType: string) => Promise<void>;
};

function handleNodeSelect(node: StrategyNode, api: WindowApiType) {
  // Build breadcrumb path
  const breadcrumb = buildBreadcrumbPath(node);
  api.setBreadcrumb(breadcrumb);

  // Open appropriate view or editor
  switch (node.level) {
    case 1:
      api.openView('strategy.hub');
      break;
    case 2:
      api.openView('strategy.providerPortal', { providerId: node.id });
      break;
    case 3:
      api.openView('strategy.groupList', { groupId: node.id });
      break;
    case 4:
      api.openEditor(node.resourceUri || `strategy://${node.id}`, 'strategy.regimeEditor');
      break;
  }
}

function buildBreadcrumbPath(node: StrategyNode): { id: string; label: string }[] {
  const path: { id: string; label: string }[] = [];

  // Always start with hub
  if (node.level >= 1) {
    path.push({ id: 'hub', label: 'STRATEGY HUB' });
  }

  // Add current node if not hub
  if (node.level > 1) {
    path.push({ id: node.id, label: node.label });
  }

  return path;
}

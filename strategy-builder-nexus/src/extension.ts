/**
 * Strategy Plugin - Extension Entry Point
 *
 * TICKET_097_4: Bridge Integration
 * - Bridge.registerStrategy() for Core registry
 * - Query available data feeds from Bridge
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
import { LLMSettingsProvider } from './providers/LLMSettingsProvider';

// TICKET_097_4: Bridge Integration
import { Bridge } from '@quantnexus/bridge';
import type { StrategyRegistration, DataFeedInfo } from '@quantnexus/bridge';

// Store disposables for cleanup
const disposables: Disposable[] = [];

// Store provider instances for inter-provider communication
let treeProvider: StrategyTreeDataProvider | null = null;

// TICKET_097_4: Bridge instance
let bridge: Bridge | null = null;

/**
 * Activate the plugin
 */
export async function activate(context: PluginContext): Promise<PluginApi> {
  context.log.info('Strategy Plugin activating...');

  // ===========================================================================
  // TICKET_097_4: Initialize Bridge
  // ===========================================================================
  try {
    bridge = new Bridge();
    context.log.info('Bridge initialized for strategy registration');
  } catch (err) {
    context.log.warn(`Bridge initialization failed (fallback mode): ${err}`);
    // Continue without Bridge - fallback to IPC mode
  }

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
  // Register Settings Provider (TICKET_089, TICKET_090)
  // ---------------------------------------------------------------------------

  const llmSettingsProvider = new LLMSettingsProvider();
  disposables.push(api.registerViewProvider('strategy.llmSettings', llmSettingsProvider));
  context.log.info('LLMSettingsProvider registered');

  // ---------------------------------------------------------------------------
  // Register Custom Editor Provider
  // ---------------------------------------------------------------------------
  // NOTE: RegimeEditorProvider is registered by strategy-plugin-bridge.tsx
  // which has direct access to the RegimeEditor React component.
  // Registering here would override the bridge's registration with an empty fallback.

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

  // ---------------------------------------------------------------------------
  // TICKET_097_4: Bridge Commands
  // ---------------------------------------------------------------------------

  // Command: Register Strategy to Core
  context.commands.register('strategy.register', (strategyDef: {
    id: string;
    name: string;
    type: 'tick' | 'bar' | 'event';
  }) => {
    if (!bridge) {
      context.log.warn('Bridge not available, strategy registration skipped');
      return false;
    }

    const registration: StrategyRegistration = {
      id: `user.${strategyDef.id}`,
      pluginId: 'com.quantnexus.strategy-builder-nexus',
      type: strategyDef.type,
    };

    const success = bridge.registerStrategy(registration);
    if (success) {
      context.log.info(`Strategy registered to Core: ${registration.id}`);
    } else {
      context.log.error(`Failed to register strategy: ${registration.id}`);
    }
    return success;
  });

  // Command: Get available data feeds from Bridge
  context.commands.register('strategy.getDataFeeds', (): DataFeedInfo[] => {
    if (!bridge) {
      context.log.warn('Bridge not available, returning empty data feeds');
      return [];
    }
    return bridge.getDataFeeds().map(df => ({
      id: df.id,
      name: df.id,
      description: `Adapter: ${df.adapter}`,
    }));
  });

  // Command: Get registered strategies
  context.commands.register('strategy.getRegistered', () => {
    if (!bridge) {
      return [];
    }
    return bridge.getStrategies();
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
  // ===========================================================================
  // TICKET_097_4: Cleanup Bridge resources
  // ===========================================================================
  if (bridge) {
    // Unregister all strategies registered by this plugin
    const strategies = bridge.getStrategies();
    for (const strategy of strategies) {
      if (strategy.pluginId === 'com.quantnexus.strategy-builder-nexus') {
        bridge.unregisterStrategy(strategy.id);
      }
    }
    bridge.disconnect();
    bridge = null;
  }

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

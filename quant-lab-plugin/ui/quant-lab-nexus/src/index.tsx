/**
 * QUANT LAB UI Plugin Entry
 *
 * TICKET_250_11: QUANT LAB UI Plugin
 * PLUGIN_TICKET_003: Added activate/deactivate for plugin lifecycle
 *
 * Main entry point for the Alpha Factory UI.
 */

import type { PluginModule, PluginContext, PluginApi, Disposable } from '@shared/types';

// Export types and constants
export type { QuantLabSubPage, SignalChip, CombinatorMethod, ConfigSummary } from './types';
export { SIGNAL_COMBINATOR_METHODS, EXIT_COMBINATOR_METHODS } from './constants';

// Export pages
export { AlphaFactoryPage } from './pages/AlphaFactoryPage';
export { QuantLabHub } from './pages/QuantLabHub';
export { SignalLibraryPage } from './pages/SignalLibrary';

// Export components
export { SignalSourceCard } from './components/SignalSourceCard';
export { CombinatorConfig } from './components/CombinatorConfig';
export { SignalFlowCanvas } from './components/SignalFlowCanvas';
export { SignalTraceViewer } from './components/SignalTraceViewer';
export { SignalFactorySection } from './components/SignalFactorySection';
export { ExitFactorySection } from './components/ExitFactorySection';
export { SignalChip as SignalChipComponent } from './components/SignalChip';
export { SignalSourcePicker } from './components/SignalSourcePicker';
export { FeatureCard } from './components/FeatureCard';
export { FlowDivider } from './components/FlowDivider';
export { ActionBar } from './components/ActionBar';
export { ConfigSidebar } from './components/ConfigSidebar';

// Export hooks
export { useAlphaFactory } from './hooks/useAlphaFactory';

// =============================================================================
// Plugin State
// =============================================================================

const disposables: Disposable[] = [];

// =============================================================================
// Plugin Module Export
// =============================================================================

const plugin: PluginModule = {
  async activate(context: PluginContext): Promise<PluginApi> {
    context.log.info('QUANT LAB plugin activating...');

    // Access windowApi from global (injected by host)
    const windowApi = (globalThis as { nexus?: { window: unknown } }).nexus?.window;

    if (windowApi) {
      const api = windowApi as {
        registerTreeDataProvider: (viewId: string, provider: unknown) => Disposable;
        registerViewProvider: (viewId: string, provider: unknown) => Disposable;
        setBreadcrumb: (items: unknown[]) => void;
        openView: (viewId: string, options?: unknown) => Promise<void>;
      };

      // Register commands
      context.commands.register('quantLab.openFactory', () => {
        api.setBreadcrumb([{ id: 'quantLab', label: 'QUANT LAB' }]);
        api.openView('quantLab.alphaFactory');
      });

      context.commands.register('quantLab.openSignals', () => {
        api.setBreadcrumb([{ id: 'quantLab', label: 'QUANT LAB' }, { id: 'signals', label: 'Signal Library' }]);
        api.openView('quantLab.signalLibrary');
      });
    } else {
      context.log.warn('windowApi not available - running in headless mode');
    }

    context.log.info('QUANT LAB plugin activated');

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
    console.info('[QUANT LAB Plugin] Deactivated');
  },
};

export default plugin;

// Plugin metadata
export const pluginInfo = {
  id: 'quant-lab-nexus',
  name: 'QUANT LAB',
  version: '1.0.0',
  description: 'Alpha Factory - Signal combination and evaluation',
  routes: [
    { path: '/quant-lab', component: 'AlphaFactoryPage' },
    { path: '/quant-lab/signals', component: 'SignalLibraryPage' },
  ],
};

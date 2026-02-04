/**
 * QUANT LAB UI Plugin Entry
 *
 * TICKET_250_11: QUANT LAB UI Plugin
 *
 * Main entry point for the Alpha Factory UI.
 */

import React from 'react';

// Export pages
export { AlphaFactoryPage } from './pages/AlphaFactory';
export { SignalLibraryPage } from './pages/SignalLibrary';

// Export components
export { SignalSourceCard } from './components/SignalSourceCard';
export { CombinatorConfig } from './components/CombinatorConfig';
export { SignalFlowCanvas } from './components/SignalFlowCanvas';
export { SignalTraceViewer } from './components/SignalTraceViewer';

// Export hooks
export { useAlphaFactory } from './hooks/useAlphaFactory';

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

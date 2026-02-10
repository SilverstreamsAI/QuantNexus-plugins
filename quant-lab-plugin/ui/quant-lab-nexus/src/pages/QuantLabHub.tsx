/**
 * QuantLabHub Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Hub landing page with header, feature cards, and status display.
 */

import React from 'react';
import { FlaskConical, Layers, Cpu } from 'lucide-react';
import { FeatureCard } from '../components/FeatureCard';

interface QuantLabHubProps {
  onNavigateToFactory: () => void;
  onNavigateToEngineStore: () => void;
}

export const QuantLabHub: React.FC<QuantLabHubProps> = ({ onNavigateToFactory, onNavigateToEngineStore }) => {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-color-terminal-accent-primary/20 to-color-terminal-accent-teal/20 flex items-center justify-center border border-color-terminal-accent-primary/30">
            <FlaskConical className="w-8 h-8 text-color-terminal-accent-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-color-terminal-text-primary">
              QUANT LAB
            </h1>
            <p className="text-color-terminal-text-secondary">
              Alpha Factory - Multi-strategy signal combination
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <FeatureCard
            icon={Layers}
            title="Signal Factory"
            description="Create and manage multiple signal sources for alpha generation"
            onClick={onNavigateToFactory}
          />
          <FeatureCard
            icon={Cpu}
            title="Engine Store"
            description="Install and manage factor evaluation engines"
            onClick={onNavigateToEngineStore}
          />
        </div>

        {/* Status */}
        <div className="p-4 rounded-lg border border-color-terminal-accent-primary/30 bg-color-terminal-accent-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-color-terminal-text-secondary">
              Plugin ready. Click Combinator to configure signal combination.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

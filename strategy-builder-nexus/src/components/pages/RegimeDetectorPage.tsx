/**
 * RegimeDetectorPage Component
 *
 * Market Regime Detector page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_042 - Strategy Editor Plugin Design
 */

import React, { useState, useCallback } from 'react';
import { Settings, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RegimeSelector, BespokeData, ExpressionInput, StrategyCard } from '../ui';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Strategy {
  id: string;
  expression: string;
}

interface RegimeDetectorPageProps {
  onGenerate?: (config: unknown) => Promise<void>;
  onSettingsClick?: () => void;
  /** Page title from navigation - uses feature name from PluginHub button */
  pageTitle?: string;
}

// -----------------------------------------------------------------------------
// RegimeDetectorPage Component
// -----------------------------------------------------------------------------

export const RegimeDetectorPage: React.FC<RegimeDetectorPageProps> = ({
  onGenerate,
  onSettingsClick,
  pageTitle,
}) => {
  // State
  const [strategyName, setStrategyName] = useState('New Strategy');
  const [isSaved, setIsSaved] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedRegime, setSelectedRegime] = useState('trend');
  const [bespokeData, setBespokeData] = useState<BespokeData>({ name: '', notes: '' });

  // Handle strategy name change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStrategyName(e.target.value);
    setIsSaved(false);
  }, []);

  // Handle add strategy from ExpressionInput
  const handleAddStrategy = useCallback((expression: string) => {
    const newStrategy: Strategy = {
      id: `strategy-${Date.now()}`,
      expression,
    };
    setStrategies(prev => [...prev, newStrategy]);
    setIsSaved(false);
  }, []);

  // Handle delete strategy
  const handleDeleteStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
    setIsSaved(false);
  }, []);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (onGenerate) {
      await onGenerate({
        name: strategyName,
        regime: selectedRegime,
        bespoke: selectedRegime === 'bespoke' ? bespokeData : undefined,
        strategies: strategies.map(s => s.expression),
      });
    }
  }, [onGenerate, strategyName, selectedRegime, bespokeData, strategies]);

  return (
    <div className="h-full flex flex-col bg-color-terminal-bg text-color-terminal-text">
      {/* ================================================================== */}
      {/* Zone A: Page Header                                                */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle || 'Strategy Studio'}
        </h1>
        <button
          onClick={onSettingsClick}
          className="p-2 text-color-terminal-text-muted hover:text-color-terminal-text hover:bg-white/5 rounded transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================================================================ */}
        {/* Zone B: Strategy Sidebar                                         */}
        {/* ================================================================ */}
        <div className="w-56 flex-shrink-0 border-r border-color-terminal-border bg-color-terminal-panel/30 p-4 overflow-y-auto">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              Current Strategy
            </label>
            <input
              type="text"
              value={strategyName}
              onChange={handleNameChange}
              placeholder="Strategy Name"
              className="w-full px-3 py-2 text-xs text-black placeholder:text-gray-500 bg-color-terminal-surface border border-color-terminal-border rounded focus:border-color-terminal-accent-gold/50 focus:outline-none"
            />
            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-[10px]">
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isSaved ? 'bg-color-terminal-accent-teal' : 'bg-color-terminal-text-muted'
                )}
              />
              <span
                className={cn(
                  isSaved ? 'text-color-terminal-accent-teal' : 'text-color-terminal-text-muted'
                )}
              >
                {isSaved ? 'Saved' : 'Unsaved'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Content Area (Zone C + Zone D) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ============================================================== */}
          {/* Zone C: Variable Content Area                                   */}
          {/* ============================================================== */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* component2: Regime Selector */}
            <RegimeSelector
              selectedRegime={selectedRegime}
              onSelect={setSelectedRegime}
              bespokeData={bespokeData}
              onBespokeChange={setBespokeData}
              className="mb-8"
            />

            {/* component1: Expression Builder (Input + Cards) */}
            <ExpressionInput
              onAdd={handleAddStrategy}
              className="mb-6"
            />

            {/* Strategy Cards */}
            {strategies.length > 0 && (
              <div className="space-y-3">
                {strategies.map((strategy) => (
                  <StrategyCard
                    key={strategy.id}
                    id={strategy.id}
                    expression={strategy.expression}
                    onDelete={handleDeleteStrategy}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* Zone D: Action Bar                                              */}
          {/* ============================================================== */}
          <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
            {/* Primary Action */}
            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border border-color-terminal-accent-gold rounded bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20 transition-all"
            >
              <Play className="w-4 h-4" />
              Start Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegimeDetectorPage;

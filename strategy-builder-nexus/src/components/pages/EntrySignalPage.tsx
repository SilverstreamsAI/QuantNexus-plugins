/**
 * EntrySignalPage Component (page31)
 *
 * Entry Signal Generator page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 * Zone C displays component4 (DirectionalIndicatorSelector).
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_078 - Input Theming and Portal Patterns
 */

import React, { useState, useCallback } from 'react';
import { Settings, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DirectionalIndicatorSelector, DirectionalIndicatorBlock, IndicatorDefinition, StrategyTemplate } from '../ui';

// Import indicator data (same as component3)
import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';
import strategyTemplates from '../../../assets/indicators/strategy-templates-library.json';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EntrySignalPageProps {
  onGenerate?: (config: unknown) => Promise<void>;
  onSettingsClick?: () => void;
  /** Page title from navigation - uses feature name from PluginHub button */
  pageTitle?: string;
}

// -----------------------------------------------------------------------------
// EntrySignalPage Component
// -----------------------------------------------------------------------------

export const EntrySignalPage: React.FC<EntrySignalPageProps> = ({
  onGenerate,
  onSettingsClick,
  pageTitle,
}) => {
  // State
  const [strategyName, setStrategyName] = useState('New Entry Strategy');
  const [isSaved, setIsSaved] = useState(false);
  const [entryBlocks, setEntryBlocks] = useState<DirectionalIndicatorBlock[]>([]);

  // Handle strategy name change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStrategyName(e.target.value);
    setIsSaved(false);
  }, []);

  // Handle generate
  const handleGenerate = useCallback(async () => {
    if (onGenerate) {
      await onGenerate({
        name: strategyName,
        entrySignals: entryBlocks,
      });
    }
  }, [onGenerate, strategyName, entryBlocks]);

  return (
    <div className="h-full flex flex-col bg-color-terminal-bg text-color-terminal-text">
      {/* ================================================================== */}
      {/* Zone A: Page Header                                                */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle || 'Entry Signal Generator'}
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
              className="w-full px-3 py-2 text-xs border rounded focus:outline-none"
              style={{
                backgroundColor: '#112240',
                borderColor: '#233554',
                color: '#e6f1ff',
              }}
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
            {/* component4: Directional Indicator Selector */}
            <DirectionalIndicatorSelector
              indicators={indicatorData as IndicatorDefinition[]}
              templates={strategyTemplates as Record<string, StrategyTemplate>}
              blocks={entryBlocks}
              onChange={setEntryBlocks}
            />
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

export default EntrySignalPage;

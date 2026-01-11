/**
 * RegimeDetectorPage Component
 *
 * Market Regime Detector page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_078 - Input Theming and Portal Patterns
 * @see TICKET_042 - Strategy Editor Plugin Design
 */

import React, { useState, useCallback } from 'react';
import { Settings, Play, Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RegimeSelector, BespokeData, ExpressionInput, StrategyCard, IndicatorSelector, IndicatorBlock, IndicatorDefinition, StrategyTemplate, useValidateBeforeGenerate } from '../ui';

// Import indicator data
import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';
import strategyTemplates from '../../../assets/indicators/strategy-templates-library.json';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Strategy {
  id: string;
  expression: string;
}

interface GenerateResult {
  code?: string;
  error?: string;
}

interface RegimeDetectorPageProps {
  onGenerate?: (config: unknown) => Promise<void>;
  onSettingsClick?: () => void;
  /** Page title from navigation - uses feature name from PluginHub button */
  pageTitle?: string;
  /** Loading state during generation (TICKET_082) */
  isGenerating?: boolean;
  /** Result from generation API (TICKET_082) */
  generateResult?: GenerateResult | null;
}

// -----------------------------------------------------------------------------
// RegimeDetectorPage Component
// -----------------------------------------------------------------------------

export const RegimeDetectorPage: React.FC<RegimeDetectorPageProps> = ({
  onGenerate,
  onSettingsClick,
  pageTitle,
  isGenerating = false,
  generateResult,
}) => {
  // State
  const [strategyName, setStrategyName] = useState('New Strategy');
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedRegime, setSelectedRegime] = useState('trend');
  const [bespokeData, setBespokeData] = useState<BespokeData>({ name: '', notes: '' });
  const [indicatorBlocks, setIndicatorBlocks] = useState<IndicatorBlock[]>([]);

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

  // Combine all rules for validation (TICKET_087)
  // Rules = indicatorBlocks (template-based) + strategies (custom expressions)
  const allRules = [
    ...indicatorBlocks,
    ...strategies.map(s => ({ type: 'custom_expression', expression: s.expression })),
  ];

  // Validation hook (TICKET_087)
  const { validate } = useValidateBeforeGenerate({
    items: allRules,
    errorMessage: 'Please add at least one indicator or expression',
    onValidationFail: (message) => {
      // TODO: Replace with toast notification when available
      console.warn('[RegimeDetector] Validation failed:', message);
      alert(message);
    },
  });

  // Handle generate with validation (TICKET_087)
  const handleGenerate = useCallback(async () => {
    // Validate before proceeding
    if (!validate()) {
      return;
    }

    if (onGenerate) {
      await onGenerate({
        name: strategyName,
        regime: selectedRegime,
        bespoke: selectedRegime === 'bespoke' ? bespokeData : undefined,
        indicators: indicatorBlocks,
        strategies: strategies.map(s => s.expression),
      });
    }
  }, [onGenerate, strategyName, selectedRegime, bespokeData, indicatorBlocks, strategies, validate]);

  // Handle copy code to clipboard
  const handleCopyCode = useCallback(async () => {
    if (generateResult?.code) {
      try {
        await navigator.clipboard.writeText(generateResult.code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    }
  }, [generateResult?.code]);

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
            {/* component2: Regime Selector */}
            <RegimeSelector
              selectedRegime={selectedRegime}
              onSelect={setSelectedRegime}
              bespokeData={bespokeData}
              onBespokeChange={setBespokeData}
              className="mb-8"
            />

            {/* component3: Indicator Selector */}
            <IndicatorSelector
              indicators={indicatorData as IndicatorDefinition[]}
              templates={strategyTemplates as Record<string, StrategyTemplate>}
              blocks={indicatorBlocks}
              onChange={setIndicatorBlocks}
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

            {/* ============================================================ */}
            {/* Result Display Area (TICKET_082)                              */}
            {/* ============================================================ */}
            {(generateResult || isGenerating) && (
              <div className="mt-8 border border-color-terminal-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-color-terminal-surface border-b border-color-terminal-border flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-color-terminal-text-secondary">
                    Generated Strategy Code
                  </h3>
                  {generateResult?.code && (
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-color-terminal-text-muted hover:text-color-terminal-text bg-white/5 hover:bg-white/10 rounded transition-all"
                    >
                      {codeCopied ? (
                        <>
                          <Check className="w-3 h-3 text-color-terminal-accent-teal" />
                          <span className="text-color-terminal-accent-teal">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="p-4 bg-color-terminal-bg max-h-96 overflow-y-auto">
                  {isGenerating && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-color-terminal-accent-gold" />
                      <span className="ml-3 text-sm text-color-terminal-text-muted">
                        Generating strategy code...
                      </span>
                    </div>
                  )}

                  {generateResult?.error && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">Generation Failed</p>
                        <p className="text-xs text-red-400/80 mt-1">{generateResult.error}</p>
                      </div>
                    </div>
                  )}

                  {generateResult?.code && (
                    <pre className="text-xs font-mono text-color-terminal-text whitespace-pre-wrap break-words">
                      <code>{generateResult.code}</code>
                    </pre>
                  )}
                </div>
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
              disabled={isGenerating}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all",
                isGenerating
                  ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                  : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Generate
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegimeDetectorPage;

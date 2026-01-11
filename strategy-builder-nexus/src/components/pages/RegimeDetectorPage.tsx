/**
 * RegimeDetectorPage Component
 *
 * Market Regime Detector page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 *
 * TICKET_091: Plugin directly calls API (CSP relaxed)
 * TICKET_095: Plugin manages its own generation state
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_078 - Input Theming and Portal Patterns
 * @see TICKET_042 - Strategy Editor Plugin Design
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, Play, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RegimeSelector, BespokeData, ExpressionInput, StrategyCard, IndicatorSelector, IndicatorBlock, IndicatorDefinition, StrategyTemplate, useValidateBeforeGenerate, CodeDisplay, CodeDisplayState } from '../ui';

// TICKET_091: Plugin directly calls API service
import { executeMarketRegimeAnalysis, validateMarketRegimeConfig, MarketRegimeRule } from '../../services';

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
  onSettingsClick?: () => void;
  /** Page title from navigation - uses feature name from PluginHub button */
  pageTitle?: string;
  /** LLM provider setting from plugin config */
  llmProvider?: string;
  /** LLM model setting from plugin config */
  llmModel?: string;
}

// -----------------------------------------------------------------------------
// RegimeDetectorPage Component
// -----------------------------------------------------------------------------

export const RegimeDetectorPage: React.FC<RegimeDetectorPageProps> = ({
  onSettingsClick,
  pageTitle,
  llmProvider = 'NONA',
  llmModel = 'nona-fast',
}) => {
  // State
  const [strategyName, setStrategyName] = useState('New Strategy');
  const [isSaved, setIsSaved] = useState(false);

  // Plugin manages its own generation state (TICKET_095 refactor)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);

  // Ref for auto-scroll to code display (TICKET_095)
  const codeDisplayRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to code display when result is ready (TICKET_095)
  useEffect(() => {
    if (generateResult?.code && codeDisplayRef.current) {
      codeDisplayRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [generateResult?.code]);

  // Determine CodeDisplay state (TICKET_095)
  const getCodeDisplayState = useCallback((): CodeDisplayState => {
    if (isGenerating) return 'loading';
    if (generateResult?.error) return 'error';
    if (generateResult?.code) return 'success';
    return 'idle';
  }, [isGenerating, generateResult]);

  // Check if we have a previous result (for button text)
  const hasResult = Boolean(generateResult?.code);

  // Handle generate with validation (TICKET_087, TICKET_091, TICKET_095)
  // TICKET_091: Plugin directly calls API service (CSP relaxed)
  const handleGenerate = useCallback(async () => {
    // Validate UI state before proceeding
    if (!validate()) {
      return;
    }

    // Build rules from indicators and custom expressions
    const rules: MarketRegimeRule[] = [];

    // Add indicator-based rules
    for (const ind of indicatorBlocks) {
      if (!ind.indicatorSlug) continue;

      const thresholdValue = ind.ruleThresholdValue;
      const validThreshold = (thresholdValue !== undefined && thresholdValue !== null)
        ? thresholdValue
        : 0;

      rules.push({
        rule_type: 'template_based',
        indicator: {
          slug: ind.indicatorSlug,
          name: ind.indicatorSlug,
          params: ind.paramValues as Record<string, unknown>,
        },
        strategy: {
          logic: {
            type: ind.templateKey || 'threshold_level',
            operator: ind.ruleOperator || '>',
            threshold_value: validThreshold,
          },
        },
      });
    }

    // Add custom expression rules
    for (const expr of strategies) {
      rules.push({
        rule_type: 'custom_expression',
        expression: expr.expression,
      });
    }

    // Build regime value
    let regimeValue = selectedRegime;
    if (regimeValue === 'bespoke' && bespokeData?.name) {
      regimeValue = `bespoke_${bespokeData.name}`;
    }

    // Validate config
    const config = {
      regime: regimeValue,
      rules,
      strategy_name: strategyName,
      bespoke_notes: bespokeData?.notes,
      llm_provider: llmProvider,
      llm_model: llmModel,
    };

    const validation = validateMarketRegimeConfig(config);
    if (!validation.valid) {
      console.warn('[RegimeDetector] Validation failed:', validation.error);
      setGenerateResult({ error: validation.error });
      return;
    }

    // Set loading state
    setIsGenerating(true);
    setGenerateResult(null);

    try {
      console.debug('[RegimeDetector] Calling API directly:', config);
      const result = await executeMarketRegimeAnalysis(config);

      // Debug logs for CodeDisplay verification
      console.log('[RegimeDetector] API result status:', result.status);
      console.log('[RegimeDetector] strategy_code length:', result.strategy_code?.length);
      console.log('[RegimeDetector] strategy_code preview:', result.strategy_code?.substring(0, 200));

      if (result.status === 'completed' && result.strategy_code) {
        console.log('[RegimeDetector] Setting generateResult with code');
        setGenerateResult({ code: result.strategy_code });
      } else if (result.status === 'failed') {
        setGenerateResult({ error: result.error?.message || 'Generation failed' });
      } else {
        setGenerateResult({ error: 'Unexpected result status' });
      }
    } catch (error) {
      console.error('[RegimeDetector] Generate error:', error);
      setGenerateResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [strategyName, selectedRegime, bespokeData, indicatorBlocks, strategies, validate, llmProvider, llmModel]);

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
            {/* Result Display Area - component5: CodeDisplay (TICKET_095)    */}
            {/* ============================================================ */}
            {(generateResult || isGenerating) && (
              <div ref={codeDisplayRef} className="mt-8">
                <CodeDisplay
                  code={generateResult?.code || ''}
                  state={getCodeDisplayState()}
                  errorMessage={generateResult?.error}
                  title="GENERATED STRATEGY CODE"
                  showLineNumbers={true}
                  maxHeight="400px"
                />
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* Zone D: Action Bar                                              */}
          {/* ============================================================== */}
          <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
            {/* Primary Action (TICKET_095: Show REGENERATE when has result) */}
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
              ) : hasResult ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Regenerate
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

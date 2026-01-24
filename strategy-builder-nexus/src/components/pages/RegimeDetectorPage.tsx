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
import { RegimeSelector, BespokeData, ExpressionInput, StrategyCard, IndicatorSelector, IndicatorBlock, IndicatorDefinition, StrategyTemplate, useValidateBeforeGenerate, CodeDisplay, CodeDisplayState, FactorAddSelector, FactorDefinition, FactorBlock, ApiKeyPrompt, NamingDialog } from '../ui';
import { useLLMAccess } from '../../hooks/useLLMAccess';

// TICKET_091: Plugin directly calls API service
import { executeMarketRegimeAnalysis, validateMarketRegimeConfig, MarketRegimeRule, saveAlgorithm, getErrorMessage, ERROR_CODE_MESSAGES } from '../../services';

// Import indicator data
import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';
import strategyTemplates from '../../../assets/indicators/strategy-templates-library.json';

// Sample factor data (component6)
const sampleFactors: FactorDefinition[] = [
  { name: 'KMID', category: 'technical', ic: null, icir: null },
  { name: 'KLEN', category: 'volatility', ic: null, icir: null },
  { name: 'KMID2', category: 'technical', ic: null, icir: null },
  { name: 'KUP', category: 'technical', ic: null, icir: null },
  { name: 'KUP2', category: 'technical', ic: null, icir: null },
  { name: 'KLOW', category: 'technical', ic: null, icir: null },
  { name: 'KLOW2', category: 'technical', ic: null, icir: null },
  { name: 'KSFT', category: 'technical', ic: null, icir: null },
  { name: 'KSFT2', category: 'technical', ic: null, icir: null },
  { name: 'OPEN0', category: 'technical', ic: null, icir: null },
  { name: 'ROC_5', category: 'momentum', ic: null, icir: null },
  { name: 'ROC_10', category: 'momentum', ic: null, icir: null },
  { name: 'ROC_20', category: 'momentum', ic: null, icir: null },
  { name: 'MA_5', category: 'technical', ic: null, icir: null },
  { name: 'MA_10', category: 'technical', ic: null, icir: null },
  { name: 'MA_20', category: 'technical', ic: null, icir: null },
  { name: 'STD_5', category: 'volatility', ic: null, icir: null },
  { name: 'STD_10', category: 'volatility', ic: null, icir: null },
  { name: 'STD_20', category: 'volatility', ic: null, icir: null },
  { name: 'VOLUME_5', category: 'volume', ic: null, icir: null },
  { name: 'VOLUME_10', category: 'volume', ic: null, icir: null },
  { name: 'VOLUME_20', category: 'volume', ic: null, icir: null },
];

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

  // TICKET_199: NamingDialog state
  const [namingDialogVisible, setNamingDialogVisible] = useState(false);

  // Ref for auto-scroll to code display (TICKET_095)
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedRegime, setSelectedRegime] = useState('trend');
  const [bespokeData, setBespokeData] = useState<BespokeData>({ name: '', notes: '' });
  const [indicatorBlocks, setIndicatorBlocks] = useState<IndicatorBlock[]>([]);
  const [factorBlocks, setFactorBlocks] = useState<FactorBlock[]>([]);

  // TICKET_190: LLM access check hook
  // Layer 2: checkOnMount for one-time page entry prompt
  // Layer 3: checkAccess for button click interception
  const {
    checkAccess,
    showPrompt,
    userTier,
    closePrompt,
    openSettings,
    triggerUpgrade,
    triggerLogin,
  } = useLLMAccess({
    llmProvider, // Pass current provider to determine access rules
    checkOnMount: true, // Layer 2: Show prompt on page entry (once per session)
    pageId: 'regime-detector-page', // Unique page identifier for session tracking
    onOpenSettings: onSettingsClick,
    onUpgrade: () => {
      console.log('[RegimeDetector] Upgrade requested');
      globalThis.nexus?.window?.openExternal?.('https://ai.silvonastream.com/pricing');
    },
    onLogin: () => {
      console.log('[RegimeDetector] Login requested');
      window.electronAPI.auth?.login();
    },
  });

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
  // Rules = indicatorBlocks (template-based) + factorBlocks + strategies (custom expressions)
  const allRules = [
    ...indicatorBlocks,
    ...factorBlocks,
    ...strategies.map(s => ({ type: 'custom_expression', expression: s.expression })),
  ];

  // Validation hook (TICKET_087)
  const { validate } = useValidateBeforeGenerate({
    items: allRules,
    errorMessage: 'Please add at least one indicator, factor, or expression',
    onValidationFail: (message) => {
      console.warn('[RegimeDetector] Validation failed:', message);
      // Use Host modal API via nexus.window (TICKET_096)
      globalThis.nexus?.window?.showAlert(message);
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

  // TICKET_199: Show naming dialog before generation
  const handleShowNamingDialog = useCallback(async () => {
    // TICKET_190: Check LLM access first
    const hasAccess = await checkAccess();
    if (!hasAccess) {
      return;
    }

    // Validate UI state before showing dialog
    if (!validate()) {
      return;
    }

    // Show naming dialog
    setNamingDialogVisible(true);
  }, [checkAccess, validate]);

  // TICKET_199: Handle naming dialog cancel
  const handleCancelNaming = useCallback(() => {
    setNamingDialogVisible(false);
  }, []);

  // Handle generate with validation (TICKET_087, TICKET_091, TICKET_095, TICKET_190, TICKET_199)
  // TICKET_091: Plugin directly calls API service (CSP relaxed)
  // TICKET_199: Called after NamingDialog confirmation with final strategy name
  const executeGeneration = useCallback(async (finalStrategyName: string) => {
    // Update strategy name from dialog
    setStrategyName(finalStrategyName);

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

    // Add factor-based rules
    for (const fac of factorBlocks) {
      if (!fac.factorName) continue;

      rules.push({
        rule_type: 'factor_based',
        factor: {
          name: fac.factorName,
          category: fac.category,
          params: fac.paramValues as Record<string, unknown>,
        },
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
      strategy_name: finalStrategyName,
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

        // TICKET_077_COMPONENT7_SAVE_MISSING: Save algorithm to database
        try {
          console.log('[RegimeDetector] Saving generated algorithm to database...');
          const saveResult = await saveAlgorithm({
            strategy_name: finalStrategyName,
            strategy_type: 9, // Regime Detector
            generated_code: result.strategy_code,
            metadata: {
              regime: selectedRegime,
              llm_provider: llmProvider,
              llm_model: llmModel,
              indicator_blocks: indicatorBlocks,
              factor_blocks: factorBlocks,
              custom_strategies: strategies,
            },
            rules: {
              indicators: indicatorBlocks,
              factors: factorBlocks,
              expressions: strategies.map(s => s.expression),
            },
            description: `${selectedRegime} regime detection strategy`,
          });

          if (saveResult.success) {
            console.log('[RegimeDetector] Algorithm saved successfully:', saveResult.data);
            setIsSaved(true);
          } else {
            console.error('[RegimeDetector] Failed to save algorithm:', saveResult.error);
          }
        } catch (saveError) {
          console.error('[RegimeDetector] Exception while saving algorithm:', saveError);
        }
      } else if (result.status === 'failed' || result.status === 'rejected') {
        // Use getErrorMessage to get user-friendly error message
        const errorMsg = getErrorMessage(result);
        console.error('[RegimeDetector] Generation failed:', result.reason_code || result.error);
        setGenerateResult({ error: errorMsg });

        // Show error popup using Host modal API
        globalThis.nexus?.window?.showAlert(errorMsg);
      } else {
        setGenerateResult({ error: 'Unexpected result status' });
      }
    } catch (error) {
      console.error('[RegimeDetector] Generate error (catch block):', error);

      // Extract error code and message from thrown error
      const err = error as Error & { code?: string; reasonCode?: string };
      const errorCode = err.code || err.reasonCode;
      console.error('[RegimeDetector] Error code:', errorCode, 'Message:', err.message);

      // Use ERROR_CODE_MESSAGES mapping if error code is available
      let errorMsg: string;
      if (errorCode && ERROR_CODE_MESSAGES[errorCode]) {
        errorMsg = ERROR_CODE_MESSAGES[errorCode];
      } else {
        errorMsg = err.message || 'Unknown error';
      }

      console.log('[RegimeDetector] Final error message:', errorMsg);
      setGenerateResult({ error: errorMsg });

      // Show error popup for caught exceptions
      globalThis.nexus?.window?.showAlert(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedRegime, bespokeData, indicatorBlocks, factorBlocks, strategies, llmProvider, llmModel]);

  // TICKET_199: Handle naming dialog confirmation
  const handleConfirmNaming = useCallback((finalName: string) => {
    setNamingDialogVisible(false);
    executeGeneration(finalName);
  }, [executeGeneration]);

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

            {/* component6: Factor Add Selector */}
            <FactorAddSelector
              factors={sampleFactors}
              blocks={factorBlocks}
              onChange={setFactorBlocks}
              maxRecommended={3}
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
            {/* Primary Action (TICKET_095: Show REGENERATE when has result, TICKET_199: Show NamingDialog) */}
            <button
              onClick={handleShowNamingDialog}
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

      {/* TICKET_190: API Key Prompt */}
      <ApiKeyPrompt
        isOpen={showPrompt}
        userTier={userTier}
        onConfigure={openSettings}
        onUpgrade={triggerUpgrade}
        onLogin={triggerLogin}
        onDismiss={closePrompt}
      />

      {/* TICKET_199: Naming Dialog */}
      <NamingDialog
        visible={namingDialogVisible}
        contextData={{ algorithm: selectedRegime || 'Regime' }}
        onConfirm={handleConfirmNaming}
        onCancel={handleCancelNaming}
      />
    </div>
  );
};

export default RegimeDetectorPage;

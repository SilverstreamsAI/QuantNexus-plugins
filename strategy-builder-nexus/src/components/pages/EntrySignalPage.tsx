/**
 * EntrySignalPage Component (page32)
 *
 * Entry Signal Generator page following TICKET_077 layout specification.
 * Zones: A (Header), B (Sidebar), C (Content), D (Action Bar)
 *
 * TICKET_077_D2: Uses unified useGenerateWorkflow hook
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_077_D2 - Unified Generate Workflow
 * @see TICKET_078 - Input Theming and Portal Patterns
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  RegimeSelector,
  BespokeData,
  ExpressionInput,
  StrategyCard,
  IndicatorSelector,
  IndicatorBlock,
  IndicatorDefinition,
  StrategyTemplate,
  CodeDisplay,
  ApiKeyPrompt,
  NamingDialog,
  GenerateContentWrapper,
  SignalModeSelector,
  SignalMode,
  GenerateActionBar,
} from '../ui';

// TICKET_077_D2: Unified Generate Workflow Hook
import {
  useGenerateWorkflow,
  GenerateWorkflowConfig,
  GenerationResult,
} from '../../hooks';

// Services - import from specific modules to avoid type conflicts
// TICKET_203: Renamed from kronos-indicator-entry-service to regime-indicator-entry-service
import {
  executeRegimeIndicatorEntry,
  validateRegimeIndicatorEntryConfig,
  IndicatorEntryRule,
  getEntryErrorMessage,
  ENTRY_ERROR_CODE_MESSAGES,
} from '../../services/regime-indicator-entry-service';
import type { RegimeIndicatorEntryConfig, RegimeIndicatorEntryResult } from '../../services/regime-indicator-entry-service';
import {
  buildEntrySignalRequest,
  extractClassName,
} from '../../services/algorithm-storage-service';
import type { AlgorithmSaveRequest } from '../../services/algorithm-storage-service';

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

interface EntrySignalPageProps {
  onSettingsClick?: () => void;
  /** Page title from navigation - uses feature name from PluginHub button */
  pageTitle?: string;
  /** LLM provider setting from plugin config */
  llmProvider?: string;
  /** LLM model setting from plugin config */
  llmModel?: string;
}

/**
 * Page state passed to workflow config builders
 */
interface EntrySignalState {
  selectedRegime: string;
  indicatorBlocks: IndicatorBlock[];
  strategies: Strategy[];
  storageMode: 'local' | 'remote' | 'hybrid';
  llmProvider: string;
  llmModel: string;
  /** TICKET_260: Signal mode for auto-reverse feature */
  signalMode: SignalMode;
}

// -----------------------------------------------------------------------------
// Workflow Config Builders
// -----------------------------------------------------------------------------

/**
 * Build rules array from page state
 */
function buildRulesFromState(state: EntrySignalState): IndicatorEntryRule[] {
  const rules: IndicatorEntryRule[] = [];

  // Add indicator-based rules
  for (const ind of state.indicatorBlocks) {
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
  for (const expr of state.strategies) {
    rules.push({
      rule_type: 'custom_expression',
      expression: expr.expression,
    });
  }

  return rules;
}

/**
 * Build API config from page state
 */
function buildApiConfig(state: EntrySignalState, strategyName: string): RegimeIndicatorEntryConfig {
  return {
    strategy_name: strategyName,
    rules: buildRulesFromState(state),
    entry_signal_base: state.selectedRegime as 'standalone' | 'trend' | 'range',
    llm_provider: state.llmProvider,
    llm_model: state.llmModel,
    storage_mode: state.storageMode,
    // TICKET_260: Auto-reverse mode
    auto_reverse: state.signalMode === 'auto-reverse',
  };
}

/**
 * Build storage request from API result
 */
function buildStorageRequestFromResult(
  result: GenerationResult,
  state: EntrySignalState,
  strategyName: string
): AlgorithmSaveRequest {
  return buildEntrySignalRequest(
    {
      strategy_name: strategyName,
      strategy_code: result.strategy_code || '',
      class_name: extractClassName(result.strategy_code || ''),
    },
    {
      regime: state.selectedRegime,
      indicator_blocks: state.indicatorBlocks,
      llm_provider: state.llmProvider,
      llm_model: state.llmModel,
    }
  );
}

// -----------------------------------------------------------------------------
// EntrySignalPage Component
// -----------------------------------------------------------------------------

export const EntrySignalPage: React.FC<EntrySignalPageProps> = ({
  onSettingsClick,
  pageTitle,
  llmProvider = 'NONA',
  llmModel = 'nona-fast',
}) => {
  // ---------------------------------------------------------------------------
  // Page-specific State (UI inputs)
  // ---------------------------------------------------------------------------

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedRegime, setSelectedRegime] = useState('trend');
  const [bespokeData, setBespokeData] = useState<BespokeData>({ name: '', notes: '' });
  const [indicatorBlocks, setIndicatorBlocks] = useState<IndicatorBlock[]>([]);
  const [storageMode, setStorageMode] = useState<'local' | 'remote' | 'hybrid'>('local');
  // TICKET_260: Signal mode for auto-reverse feature
  const [signalMode, setSignalMode] = useState<SignalMode>('auto-reverse');

  // Load storage mode from plugin config
  useEffect(() => {
    const loadStorageMode = async () => {
      try {
        const configResult = await window.electronAPI.plugin.getConfig('com.quantnexus.strategy-builder-nexus');
        if (configResult.success && configResult.config) {
          const mode = configResult.config['strategy.dataSource'] as string || 'local';
          setStorageMode(mode as 'local' | 'remote' | 'hybrid');
          console.debug('[EntrySignal] Loaded storage mode:', mode);
        }
      } catch (e) {
        console.error('[EntrySignal] Failed to load storage mode:', e);
      }
    };
    loadStorageMode();
  }, []);

  // ---------------------------------------------------------------------------
  // Workflow Configuration
  // ---------------------------------------------------------------------------

  // Current page state for workflow
  const currentState: EntrySignalState = useMemo(() => ({
    selectedRegime,
    indicatorBlocks,
    strategies,
    storageMode,
    llmProvider,
    llmModel,
    signalMode,
  }), [selectedRegime, indicatorBlocks, strategies, storageMode, llmProvider, llmModel, signalMode]);

  // Validation items
  const allRules = useMemo(() => [
    ...indicatorBlocks,
    ...strategies.map(s => ({ type: 'custom_expression', expression: s.expression })),
  ], [indicatorBlocks, strategies]);

  // Workflow config
  // TICKET_203: Updated to use Regime naming
  const workflowConfig = useMemo((): GenerateWorkflowConfig<RegimeIndicatorEntryConfig, EntrySignalState> => ({
    pageId: 'entry-signal-page',
    llmProvider,
    llmModel,
    defaultStrategyName: 'New Entry Strategy',
    validationErrorMessage: 'Please add at least one indicator, factor, or expression',
    buildConfig: buildApiConfig,
    validateConfig: validateRegimeIndicatorEntryConfig,
    executeApi: executeRegimeIndicatorEntry as (config: RegimeIndicatorEntryConfig) => Promise<GenerationResult>,
    buildStorageRequest: buildStorageRequestFromResult,
    errorMessages: ENTRY_ERROR_CODE_MESSAGES,
    getErrorMessage: (result) => getEntryErrorMessage(result as unknown as RegimeIndicatorEntryResult),
  }), [llmProvider, llmModel]);

  // ---------------------------------------------------------------------------
  // Unified Generate Workflow Hook
  // ---------------------------------------------------------------------------

  const { state, actions, llmAccess, codeDisplayRef } = useGenerateWorkflow(
    workflowConfig,
    { onSettingsClick },
    currentState,
    allRules
  );

  // ---------------------------------------------------------------------------
  // Page-specific Handlers
  // ---------------------------------------------------------------------------

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setStrategyName(e.target.value);
  }, [actions]);

  const handleAddStrategy = useCallback((expression: string) => {
    const newStrategy: Strategy = {
      id: `strategy-${Date.now()}`,
      expression,
    };
    setStrategies(prev => [...prev, newStrategy]);
  }, []);

  const handleDeleteStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-full flex flex-col bg-color-terminal-bg text-color-terminal-text">
      {/* ================================================================== */}
      {/* Zone A: Page Header                                                */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle || 'Indicator Entry Generator'}
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
              value={state.strategyName}
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
                  state.isSaved ? 'bg-color-terminal-accent-teal' : 'bg-color-terminal-text-muted'
                )}
              />
              <span
                className={cn(
                  state.isSaved ? 'text-color-terminal-accent-teal' : 'text-color-terminal-text-muted'
                )}
              >
                {state.isSaved ? 'Saved' : 'Unsaved'}
              </span>
            </div>
          </div>

          {/* TICKET_260: Signal Mode Selector */}
          <SignalModeSelector
            value={signalMode}
            onChange={setSignalMode}
            context="entry"
            className="mt-6"
          />
        </div>

        {/* Right Content Area (Zone C + Zone D) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ============================================================== */}
          {/* Zone C: Variable Content Area                                   */}
          {/* ============================================================== */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* TICKET_077_D3: Wrap input area with GenerateContentWrapper */}
            <GenerateContentWrapper
              isGenerating={state.isGenerating}
              loadingMessage="Generating entry signal code..."
            >
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
            </GenerateContentWrapper>

            {/* ============================================================ */}
            {/* Result Display Area - component5: CodeDisplay                 */}
            {/* (Outside wrapper - always visible during generation)          */}
            {/* ============================================================ */}
            {(state.generateResult || state.isGenerating) && (
              <div ref={codeDisplayRef} className="mt-8">
                <CodeDisplay
                  code={state.generateResult?.code || ''}
                  state={actions.getCodeDisplayState()}
                  errorMessage={state.generateResult?.error}
                  title="GENERATED ENTRY SIGNAL CODE"
                  showLineNumbers={true}
                  maxHeight="400px"
                />
              </div>
            )}
          </div>

          {/* Zone D: Action Bar (TICKET_298) */}
          <GenerateActionBar
            isGenerating={state.isGenerating}
            hasResult={actions.hasResult}
            onGenerate={actions.handleStartGenerate}
            generateLabel="Start Generate"
            generatingLabel="Generating..."
          />
        </div>
      </div>

      {/* TICKET_190: API Key Prompt */}
      <ApiKeyPrompt
        isOpen={llmAccess.showPrompt}
        userTier={llmAccess.userTier}
        onConfigure={llmAccess.openSettings}
        onUpgrade={llmAccess.triggerUpgrade}
        onLogin={llmAccess.triggerLogin}
        onDismiss={llmAccess.closePrompt}
      />

      {/* TICKET_199: Naming Dialog */}
      <NamingDialog
        visible={state.namingDialogVisible}
        contextData={{ algorithm: 'EntrySignal' }}
        onConfirm={actions.handleConfirmNaming}
        onCancel={actions.handleCancelNaming}
      />
    </div>
  );
};

export default EntrySignalPage;

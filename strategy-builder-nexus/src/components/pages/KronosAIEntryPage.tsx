/**
 * KronosAIEntryPage Component (page34)
 *
 * Kronos AI Entry page for LLM-powered entry signal generation.
 * Uses preset-based configuration (Baseline/Monk/Warrior/Bespoke) with prompt input.
 *
 * Key difference from KronosIndicatorEntryPage (page33):
 * - Uses TraderPresetSelector instead of IndicatorSelector
 * - Uses PromptTextarea for LLM prompt input
 * - Uses RawIndicatorSelector for optional indicator context
 *
 * @see TICKET_077_19 - Kronos AI Entry Components
 * @see TICKET_211 - Page 34 - Kronos AI Entry
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Settings, Play, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  TemplateToolbar,
  RawIndicatorSelector,
  RawIndicatorBlock,
  TraderPresetSelector,
  TraderPresetMode,
  ModeDetailsPanel,
  BespokeConfigPanel,
  BespokeConfig,
  DEFAULT_BESPOKE_CONFIG,
  PromptTextarea,
  CodeDisplay,
  ApiKeyPrompt,
  NamingDialog,
  GenerateContentWrapper,
  IndicatorDefinition,
} from '../ui';

// TICKET_077_D2: Unified Generate Workflow Hook
import {
  useGenerateWorkflow,
  GenerateWorkflowConfig,
  GenerationResult,
} from '../../hooks';

// Import indicator data for RawIndicatorSelector
import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface KronosAIEntryPageProps {
  onSettingsClick?: () => void;
  /** Page title from navigation */
  pageTitle?: string;
  /** LLM provider setting from plugin config */
  llmProvider?: string;
  /** LLM model setting from plugin config */
  llmModel?: string;
}

/**
 * API Configuration for Kronos AI Entry
 */
interface KronosAIEntryConfig {
  strategy_name: string;
  preset_mode: TraderPresetMode;
  bespoke_config?: BespokeConfig;
  prompt: string;
  indicators: RawIndicatorBlock[];
  llm_provider: string;
  llm_model: string;
  storage_mode: 'local' | 'remote' | 'hybrid';
}

/**
 * API Result for Kronos AI Entry
 */
interface KronosAIEntryResult {
  success: boolean;
  strategy_code?: string;
  error_code?: string;
  error_message?: string;
}

/**
 * Page state for workflow config
 */
interface KronosAIEntryState {
  presetMode: TraderPresetMode;
  bespokeConfig: BespokeConfig;
  prompt: string;
  indicatorBlocks: RawIndicatorBlock[];
  storageMode: 'local' | 'remote' | 'hybrid';
  llmProvider: string;
  llmModel: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_PROMPT = `Generate an entry signal strategy that:
1. Identifies optimal entry points based on the provided indicators
2. Filters out false signals using confirmation logic
3. Adapts to current market volatility
4. Manages risk with appropriate position sizing`;

const ERROR_CODE_MESSAGES: Record<string, string> = {
  INVALID_CONFIG: 'Invalid configuration provided',
  LLM_ERROR: 'LLM service error occurred',
  TIMEOUT: 'Request timed out',
  NETWORK_ERROR: 'Network connection error',
};

// -----------------------------------------------------------------------------
// Workflow Config Builders
// -----------------------------------------------------------------------------

/**
 * Build API config from page state
 */
function buildApiConfig(state: KronosAIEntryState, strategyName: string): KronosAIEntryConfig {
  return {
    strategy_name: strategyName,
    preset_mode: state.presetMode,
    bespoke_config: state.presetMode === 'bespoke' ? state.bespokeConfig : undefined,
    prompt: state.prompt,
    indicators: state.indicatorBlocks,
    llm_provider: state.llmProvider,
    llm_model: state.llmModel,
    storage_mode: state.storageMode,
  };
}

/**
 * Validate config before API call
 */
function validateConfig(config: KronosAIEntryConfig): { valid: boolean; error?: string } {
  if (!config.prompt || config.prompt.trim().length < 10) {
    return { valid: false, error: 'Please enter a prompt (at least 10 characters)' };
  }
  return { valid: true };
}

/**
 * Execute API call (placeholder - will be implemented with actual API)
 */
async function executeApi(config: KronosAIEntryConfig): Promise<GenerationResult> {
  // TODO: Implement actual API call to /api/kronos_llm_entry
  console.log('[KronosAIEntry] Execute API with config:', config);

  // Placeholder response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        strategy_code: `# Generated Kronos AI Entry Strategy
# Preset: ${config.preset_mode}
# Provider: ${config.llm_provider}

from backtrader_strategy import KronosAIEntryBase

class ${config.strategy_name.replace(/\s+/g, '')}Strategy(KronosAIEntryBase):
    """
    AI-generated entry strategy based on prompt:
    ${config.prompt.substring(0, 100)}...
    """

    params = (
        ('lookback', ${config.bespoke_config?.lookbackBars || 100}),
        ('leverage', ${config.bespoke_config?.leverage || 1}),
    )

    def __init__(self):
        super().__init__()
        # Indicator initialization based on config
        ${config.indicators.map(ind => `# ${ind.indicatorSlug || 'Unknown'}`).join('\n        ')}

    def next(self):
        # AI-generated entry logic
        if self.should_enter_long():
            self.buy()
        elif self.should_enter_short():
            self.sell()

    def should_enter_long(self):
        # Generated long entry condition
        return True  # Placeholder

    def should_enter_short(self):
        # Generated short entry condition
        return False  # Placeholder
`,
      });
    }, 2000);
  });
}

/**
 * Build storage request from result
 */
function buildStorageRequest(
  result: GenerationResult,
  state: KronosAIEntryState,
  strategyName: string
) {
  return {
    strategy_name: strategyName,
    strategy_code: result.strategy_code || '',
    class_name: `${strategyName.replace(/\s+/g, '')}Strategy`,
    strategy_type: 1, // TYPE_EXECUTION
    signal_source: 'kronosAIEntry',
    entry_signal_base: 'kronos',
    config: {
      preset_mode: state.presetMode,
      bespoke_config: state.bespokeConfig,
      prompt: state.prompt,
      indicators: state.indicatorBlocks,
    },
  };
}

/**
 * Get error message from result
 */
function getErrorMessage(result: KronosAIEntryResult): string | undefined {
  if (result.error_code && ERROR_CODE_MESSAGES[result.error_code]) {
    return ERROR_CODE_MESSAGES[result.error_code];
  }
  return result.error_message;
}

// -----------------------------------------------------------------------------
// KronosAIEntryPage Component
// -----------------------------------------------------------------------------

export const KronosAIEntryPage: React.FC<KronosAIEntryPageProps> = ({
  onSettingsClick,
  pageTitle,
  llmProvider = 'NONA',
  llmModel = 'nona-fast',
}) => {
  // ---------------------------------------------------------------------------
  // Page-specific State
  // ---------------------------------------------------------------------------

  const [presetMode, setPresetMode] = useState<TraderPresetMode>('monk');
  const [bespokeConfig, setBespokeConfig] = useState<BespokeConfig>(DEFAULT_BESPOKE_CONFIG);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [indicatorBlocks, setIndicatorBlocks] = useState<RawIndicatorBlock[]>([]);
  const [storageMode, setStorageMode] = useState<'local' | 'remote' | 'hybrid'>('local');

  // Load storage mode from plugin config
  useEffect(() => {
    const loadStorageMode = async () => {
      try {
        const configResult = await window.electronAPI.plugin.getConfig('com.quantnexus.strategy-builder-nexus');
        if (configResult.success && configResult.config) {
          const mode = configResult.config['strategy.dataSource'] as string || 'local';
          setStorageMode(mode as 'local' | 'remote' | 'hybrid');
        }
      } catch (e) {
        console.error('[KronosAIEntry] Failed to load storage mode:', e);
      }
    };
    loadStorageMode();
  }, []);

  // ---------------------------------------------------------------------------
  // Template Toolbar Handlers
  // ---------------------------------------------------------------------------

  const handleLoadTemplate = useCallback(() => {
    // TODO: Implement template loading
    console.log('[KronosAIEntry] Load template');
  }, []);

  const handleSaveTemplate = useCallback(() => {
    // TODO: Implement template saving
    console.log('[KronosAIEntry] Save template');
  }, []);

  const handleClearAll = useCallback(() => {
    setPresetMode('monk');
    setBespokeConfig(DEFAULT_BESPOKE_CONFIG);
    setPrompt(DEFAULT_PROMPT);
    setIndicatorBlocks([]);
  }, []);

  const handleAddIndicator = useCallback(() => {
    const newBlock: RawIndicatorBlock = {
      id: `ind_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      indicatorSlug: null,
      paramValues: {},
    };
    setIndicatorBlocks(prev => [...prev, newBlock]);
  }, []);

  // ---------------------------------------------------------------------------
  // Workflow Configuration
  // ---------------------------------------------------------------------------

  const currentState: KronosAIEntryState = useMemo(() => ({
    presetMode,
    bespokeConfig,
    prompt,
    indicatorBlocks,
    storageMode,
    llmProvider,
    llmModel,
  }), [presetMode, bespokeConfig, prompt, indicatorBlocks, storageMode, llmProvider, llmModel]);

  // Validation: prompt is required
  const validationItems = useMemo(() => [{ prompt }], [prompt]);

  const workflowConfig = useMemo((): GenerateWorkflowConfig<KronosAIEntryConfig, KronosAIEntryState> => ({
    pageId: 'kronos-ai-entry-page',
    llmProvider,
    llmModel,
    defaultStrategyName: 'New Kronos AI Strategy',
    validationErrorMessage: 'Please enter a prompt to generate the strategy',
    buildConfig: buildApiConfig,
    validateConfig,
    executeApi,
    buildStorageRequest,
    errorMessages: ERROR_CODE_MESSAGES,
    getErrorMessage: (result) => getErrorMessage(result as unknown as KronosAIEntryResult),
  }), [llmProvider, llmModel]);

  // ---------------------------------------------------------------------------
  // Unified Generate Workflow Hook
  // ---------------------------------------------------------------------------

  const { state, actions, llmAccess, codeDisplayRef } = useGenerateWorkflow(
    workflowConfig,
    { onSettingsClick },
    currentState,
    validationItems
  );

  // ---------------------------------------------------------------------------
  // Page-specific Handlers
  // ---------------------------------------------------------------------------

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setStrategyName(e.target.value);
  }, [actions]);

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
          {pageTitle || 'Kronos AI Entry'}
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
              className={cn(
                'w-full px-3 py-2 text-xs border rounded focus:outline-none',
                'bg-color-terminal-bg border-color-terminal-border text-color-terminal-text',
                'focus:border-color-terminal-accent-teal'
              )}
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
        </div>

        {/* Right Content Area (Zone C + Zone D) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ============================================================== */}
          {/* Zone C: Variable Content Area                                   */}
          {/* ============================================================== */}
          <div className="flex-1 overflow-y-auto p-6">
            <GenerateContentWrapper
              isGenerating={state.isGenerating}
              loadingMessage="Generating Kronos AI entry strategy..."
            >
              {/* component19: Template Toolbar */}
              <TemplateToolbar
                onLoadTemplate={handleLoadTemplate}
                onSave={handleSaveTemplate}
                onClearAll={handleClearAll}
                onAdd={handleAddIndicator}
                className="mb-6"
              />

              {/* component20: Raw Indicator Selector (Optional context) */}
              {indicatorBlocks.length > 0 && (
                <div className="mb-6">
                  <RawIndicatorSelector
                    indicators={indicatorData as IndicatorDefinition[]}
                    blocks={indicatorBlocks}
                    onChange={setIndicatorBlocks}
                    title="INDICATOR CONTEXT (OPTIONAL)"
                  />
                </div>
              )}

              {/* component21: Trader Preset Selector */}
              <TraderPresetSelector
                selectedPreset={presetMode}
                onSelect={setPresetMode}
                className="mb-6"
              />

              {/* component22: Mode Details Panel (hidden when bespoke) */}
              <ModeDetailsPanel
                mode={presetMode}
                className="mb-6"
              />

              {/* component23: Bespoke Config Panel (shown when bespoke) */}
              {presetMode === 'bespoke' && (
                <BespokeConfigPanel
                  config={bespokeConfig}
                  onChange={setBespokeConfig}
                  className="mb-6"
                />
              )}

              {/* component24: Prompt Textarea */}
              <PromptTextarea
                title="ANALYSIS PROMPT"
                value={prompt}
                onChange={setPrompt}
                placeholder="Describe the entry strategy you want to generate..."
                rows={8}
                className="mb-6"
              />
            </GenerateContentWrapper>

            {/* ============================================================ */}
            {/* Result Display Area - component5: CodeDisplay                 */}
            {/* ============================================================ */}
            {(state.generateResult || state.isGenerating) && (
              <div ref={codeDisplayRef} className="mt-8">
                <CodeDisplay
                  code={state.generateResult?.code || ''}
                  state={actions.getCodeDisplayState()}
                  errorMessage={state.generateResult?.error}
                  title="GENERATED KRONOS AI ENTRY CODE"
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
            <button
              onClick={actions.handleStartGenerate}
              disabled={state.isGenerating}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all",
                state.isGenerating
                  ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                  : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
              )}
            >
              {state.isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : actions.hasResult ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start AI Generate
                </>
              )}
            </button>
          </div>
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
        contextData={{ algorithm: 'KronosAIEntry' }}
        onConfirm={actions.handleConfirmNaming}
        onCancel={actions.handleCancelNaming}
      />
    </div>
  );
};

export default KronosAIEntryPage;

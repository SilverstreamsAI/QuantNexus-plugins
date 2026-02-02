/**
 * AILiberoPage Component (page37)
 *
 * Agent Mode AI Libero workspace page for LLM-powered strategy generation
 * with advanced configuration options.
 *
 * Key difference from TraderAIEntryPage (page36):
 * - Uses /api/agent_llm instead of /api/llm_trader
 * - Includes AdvancedConfigPanel (component26) for Prediction Configuration
 * - signal_source: aiLibero
 *
 * @see TICKET_077_26 - AI Libero Page (page37)
 * @see TICKET_214 - Page 36 - Trader AI Entry (reference)
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
  IndicatorTemplateSelectorDialog,
  IndicatorTemplate,
  SaveTemplateDialog,
  UserIndicatorTemplate,
  AdvancedConfigPanel,
  PredictionConfig,
  DEFAULT_PREDICTION_CONFIG,
  getPresetPredictionConfig,
} from '../ui';

// TICKET_077_D2: Unified Generate Workflow Hook
import {
  useGenerateWorkflow,
  GenerateWorkflowConfig,
  GenerationResult,
} from '../../hooks';

// TICKET_077_26: AI Libero Service
import {
  executeAILibero,
  validateAILiberoConfig,
  getAILiberoErrorMessage,
  AI_LIBERO_ERROR_CODE_MESSAGES,
  AILiberoConfig,
  AILiberoResult,
  loadTemplates,
  saveTemplate,
  getExistingTemplateNames,
} from '../../services/ai-libero-service';

// TICKET_077_D1: Centralized Algorithm Storage Service
import {
  buildAILiberoRequest,
  extractClassName,
  AlgorithmSaveRequest,
} from '../../services/algorithm-storage-service';

// Import indicator data for RawIndicatorSelector
import indicatorData from '../../../assets/indicators/market-analysis-indicator.json';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AILiberoPageProps {
  onSettingsClick?: () => void;
  /** Page title from navigation */
  pageTitle?: string;
  /** LLM provider setting from plugin config */
  llmProvider?: string;
  /** LLM model setting from plugin config */
  llmModel?: string;
}

/**
 * Page state for workflow config
 */
interface AILiberoState {
  presetMode: TraderPresetMode;
  bespokeConfig: BespokeConfig;
  predictionConfig: PredictionConfig;
  prompt: string;
  indicatorBlocks: RawIndicatorBlock[];
  storageMode: 'local' | 'remote' | 'hybrid';
  llmProvider: string;
  llmModel: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_PROMPT = `Generate a trading strategy that:
1. Identifies optimal entry points based on the provided indicators
2. Filters out false signals using confirmation logic
3. Adapts to current market volatility
4. Manages risk with appropriate position sizing`;

// -----------------------------------------------------------------------------
// Workflow Config Builders
// -----------------------------------------------------------------------------

/**
 * Build API config from page state
 */
function buildApiConfig(state: AILiberoState, strategyName: string): AILiberoConfig {
  return {
    strategy_name: strategyName,
    preset_mode: state.presetMode,
    bespoke_config: state.presetMode === 'bespoke' ? state.bespokeConfig : undefined,
    prediction_config: state.predictionConfig,
    prompt: state.prompt,
    indicators: state.indicatorBlocks,
    llm_provider: state.llmProvider,
    llm_model: state.llmModel,
    storage_mode: state.storageMode,
  };
}

/**
 * Execute API call using ai-libero-service
 */
async function executeApi(config: AILiberoConfig): Promise<GenerationResult> {
  console.log('[AILibero] Execute API with config:', config);

  const result = await executeAILibero(config);

  if (result.status === 'completed' && result.strategy_code) {
    return {
      status: 'completed',
      strategy_code: result.strategy_code,
    };
  }

  const errorMessage = getAILiberoErrorMessage(result);
  return {
    status: 'failed',
    error: errorMessage,
    reason_code: result.reason_code || result.error?.error_code,
  };
}

/**
 * Build storage request from result
 */
function buildStorageRequest(
  result: GenerationResult,
  state: AILiberoState,
  strategyName: string
): AlgorithmSaveRequest {
  return buildAILiberoRequest(
    {
      strategy_name: strategyName,
      strategy_code: result.strategy_code || '',
      class_name: extractClassName(result.strategy_code || ''),
    },
    {
      preset_mode: state.presetMode,
      bespoke_config: state.presetMode === 'bespoke' ? state.bespokeConfig : undefined,
      prediction_config: state.predictionConfig,
      prompt: state.prompt,
      indicators: state.indicatorBlocks,
      llm_provider: state.llmProvider,
      llm_model: state.llmModel,
    }
  );
}

// -----------------------------------------------------------------------------
// AILiberoPage Component
// -----------------------------------------------------------------------------

export const AILiberoPage: React.FC<AILiberoPageProps> = ({
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
  const [predictionConfig, setPredictionConfig] = useState<PredictionConfig>(DEFAULT_PREDICTION_CONFIG);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [indicatorBlocks, setIndicatorBlocks] = useState<RawIndicatorBlock[]>([]);
  const [storageMode, setStorageMode] = useState<'local' | 'remote' | 'hybrid'>('local');

  // Template dialog states
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [existingTemplateNames, setExistingTemplateNames] = useState<string[]>([]);

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
        console.error('[AILibero] Failed to load storage mode:', e);
      }
    };
    loadStorageMode();
  }, []);

  // Sync prediction config with preset mode changes
  useEffect(() => {
    if (presetMode !== 'bespoke') {
      setPredictionConfig(getPresetPredictionConfig(presetMode));
    }
  }, [presetMode]);

  // ---------------------------------------------------------------------------
  // Template Toolbar Handlers
  // ---------------------------------------------------------------------------

  // Handle indicator template selection from Load Template dialog
  const handleSelectTemplate = useCallback((template: IndicatorTemplate) => {
    console.log('[AILibero] Loading indicator template:', template.name);

    if (template.indicators && template.indicators.length > 0) {
      const indicatorsWithNewIds = template.indicators.map((ind, index) => ({
        ...ind,
        id: `template_${Date.now()}_${index}`,
      }));
      setIndicatorBlocks(indicatorsWithNewIds);
    }

    window.nexus?.window?.showNotification(
      `Template "${template.name}" loaded with ${template.indicators.length} indicators`,
      'success'
    );
  }, []);

  const handleLoadTemplate = useCallback(() => {
    setIsLoadDialogOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    // Load existing names for duplicate check
    const names = await getExistingTemplateNames();
    setExistingTemplateNames(names);
    setIsSaveDialogOpen(true);
  }, []);

  const handleSaveTemplateConfirm = useCallback(async (template: UserIndicatorTemplate) => {
    try {
      await saveTemplate(template);
      setIsSaveDialogOpen(false);
      window.nexus?.window?.showNotification(
        `Template "${template.name}" saved successfully`,
        'success'
      );
    } catch (error) {
      console.error('[AILibero] Failed to save template:', error);
      window.nexus?.window?.showNotification(
        'Failed to save template. Please try again.',
        'error'
      );
    }
  }, []);

  const handleClearAll = useCallback(() => {
    setPresetMode('monk');
    setBespokeConfig(DEFAULT_BESPOKE_CONFIG);
    setPredictionConfig(DEFAULT_PREDICTION_CONFIG);
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

  // Handle prediction config reset
  const handlePredictionConfigReset = useCallback(() => {
    setPredictionConfig(getPresetPredictionConfig(presetMode));
  }, [presetMode]);

  // ---------------------------------------------------------------------------
  // Workflow Configuration
  // ---------------------------------------------------------------------------

  const currentState: AILiberoState = useMemo(() => ({
    presetMode,
    bespokeConfig,
    predictionConfig,
    prompt,
    indicatorBlocks,
    storageMode,
    llmProvider,
    llmModel,
  }), [presetMode, bespokeConfig, predictionConfig, prompt, indicatorBlocks, storageMode, llmProvider, llmModel]);

  const validationItems = useMemo(() => [{ prompt }], [prompt]);

  const workflowConfig = useMemo((): GenerateWorkflowConfig<AILiberoConfig, AILiberoState> => ({
    pageId: 'ai-libero-page',
    llmProvider,
    llmModel,
    defaultStrategyName: 'New AI Libero Strategy',
    validationErrorMessage: 'Please enter a prompt to generate the strategy',
    buildConfig: buildApiConfig,
    validateConfig: validateAILiberoConfig,
    executeApi,
    buildStorageRequest,
    errorMessages: AI_LIBERO_ERROR_CODE_MESSAGES,
    getErrorMessage: (result) => getAILiberoErrorMessage(result as unknown as AILiberoResult),
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
          {pageTitle || 'AI Libero'}
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
              loadingMessage="Generating AI Libero strategy..."
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
                placeholder="Describe the trading strategy you want to generate..."
                rows={8}
                className="mb-6"
              />

              {/* component26: Advanced Config Panel */}
              <AdvancedConfigPanel
                presetMode={presetMode}
                predictionConfig={predictionConfig}
                onPredictionConfigChange={setPredictionConfig}
                onReset={handlePredictionConfigReset}
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
                  title="GENERATED AI LIBERO STRATEGY CODE"
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
                  Start Generate
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
        contextData={{ algorithm: 'AILibero' }}
        onConfirm={actions.handleConfirmNaming}
        onCancel={actions.handleCancelNaming}
      />

      {/* TICKET_212: Load Indicator Template Dialog */}
      <IndicatorTemplateSelectorDialog
        isOpen={isLoadDialogOpen}
        onClose={() => setIsLoadDialogOpen(false)}
        onSelect={handleSelectTemplate}
        title="Load Indicator Template"
        emptyMessage="No indicator templates available"
      />

      {/* TICKET_214: Save Template Dialog */}
      <SaveTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={handleSaveTemplateConfirm}
        indicators={indicatorBlocks}
        existingNames={existingTemplateNames}
      />
    </div>
  );
};

export default AILiberoPage;

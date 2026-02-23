/**
 * MarketObserverPage Component (Page 35)
 *
 * Market Observer workspace page for defining market preconditions
 * and watchlist operations within Trader Mode.
 *
 * @see TICKET_077_1 - Page Hierarchy (page35)
 * @see TICKET_202 - Builder Page Base Class Mapping
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
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
  GenerateActionBar,
} from '../ui';

// TICKET_077_D2: Unified Generate Workflow Hook
import {
  useGenerateWorkflow,
  GenerateWorkflowConfig,
  GenerationResult,
} from '../../hooks';

// Services
import {
  executeMarketObserverGeneration,
  validateMarketObserverConfig,
  getErrorMessage,
  ERROR_CODE_MESSAGES,
} from '../../services/market-observer-service';
import type {
  MarketObserverConfig,
  MarketObserverResult,
  MarketObserverRule,
} from '../../services/market-observer-service';
import {
  buildMarketObserverRequest,
  extractClassName,
} from '../../services/algorithm-storage-service';
import type { AlgorithmSaveRequest } from '../../services/algorithm-storage-service';
import { getCurrentUserIdAsString } from '../../utils/auth-utils';

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

interface MarketObserverPageProps {
  onSettingsClick?: () => void;
  pageTitle?: string;
  llmProvider?: string;
  llmModel?: string;
}

interface MarketObserverState {
  indicatorBlocks: IndicatorBlock[];
  strategies: Strategy[];
  storageMode: 'local' | 'remote' | 'hybrid';
  llmProvider: string;
  llmModel: string;
}

// -----------------------------------------------------------------------------
// Workflow Config Builders
// -----------------------------------------------------------------------------

function buildRulesFromState(state: MarketObserverState): MarketObserverRule[] {
  const rules: MarketObserverRule[] = [];

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

function buildApiConfig(state: MarketObserverState, strategyName: string): MarketObserverConfig {
  return {
    rules: buildRulesFromState(state),
    strategy_name: strategyName,
    llm_provider: state.llmProvider,
    llm_model: state.llmModel,
    storage_mode: state.storageMode,
  };
}

async function buildStorageRequestFromResult(
  result: GenerationResult,
  state: MarketObserverState,
  strategyName: string
): Promise<AlgorithmSaveRequest> {
  const userId = await getCurrentUserIdAsString();
  return buildMarketObserverRequest(
    {
      strategy_name: strategyName,
      strategy_code: result.strategy_code || '',
      class_name: extractClassName(result.strategy_code || ''),
    },
    {
      llm_provider: state.llmProvider,
      llm_model: state.llmModel,
      indicators: state.indicatorBlocks,
      rules: state.strategies.map(s => ({ expression: s.expression })),
    },
    userId
  );
}

// -----------------------------------------------------------------------------
// MarketObserverPage Component
// -----------------------------------------------------------------------------

export const MarketObserverPage: React.FC<MarketObserverPageProps> = ({
  onSettingsClick,
  pageTitle,
  llmProvider = 'NONA',
  llmModel = 'nona-fast',
}) => {
  // ---------------------------------------------------------------------------
  // Page-specific State
  // ---------------------------------------------------------------------------

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [indicatorBlocks, setIndicatorBlocks] = useState<IndicatorBlock[]>([]);
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
        console.error('[MarketObserver] Failed to load storage mode:', e);
      }
    };
    loadStorageMode();
  }, []);

  // ---------------------------------------------------------------------------
  // Workflow Configuration
  // ---------------------------------------------------------------------------

  const currentState: MarketObserverState = useMemo(() => ({
    indicatorBlocks,
    strategies,
    storageMode,
    llmProvider,
    llmModel,
  }), [indicatorBlocks, strategies, storageMode, llmProvider, llmModel]);

  // Validation items
  const allRules = useMemo(() => [
    ...indicatorBlocks,
    ...strategies.map(s => ({ type: 'custom_expression', expression: s.expression })),
  ], [indicatorBlocks, strategies]);

  // Workflow config
  const workflowConfig = useMemo((): GenerateWorkflowConfig<MarketObserverConfig, MarketObserverState> => ({
    pageId: 'market-observer-page',
    llmProvider,
    llmModel,
    defaultStrategyName: 'New Observer',
    validationErrorMessage: 'Please add at least one indicator, factor, or expression',
    buildConfig: buildApiConfig,
    validateConfig: validateMarketObserverConfig,
    executeApi: executeMarketObserverGeneration as (config: MarketObserverConfig) => Promise<GenerationResult>,
    buildStorageRequest: buildStorageRequestFromResult,
    errorMessages: ERROR_CODE_MESSAGES,
    getErrorMessage: (result) => getErrorMessage(result as unknown as MarketObserverResult),
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
      {/* Zone A: Page Header */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle || 'Market Observer'}
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
        {/* Zone B: Strategy Sidebar */}
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
        </div>

        {/* Right Content Area (Zone C + Zone D) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Zone C: Variable Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <GenerateContentWrapper
              isGenerating={state.isGenerating}
              loadingMessage="Generating observer code..."
            >
              {/* Indicator Selector */}
              <IndicatorSelector
                indicators={indicatorData as IndicatorDefinition[]}
                templates={strategyTemplates as Record<string, StrategyTemplate>}
                blocks={indicatorBlocks}
                onChange={setIndicatorBlocks}
                className="mb-8"
              />

              {/* Expression Builder */}
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

            {/* Result Display Area */}
            {(state.generateResult || state.isGenerating) && (
              <div ref={codeDisplayRef} className="mt-8">
                <CodeDisplay
                  code={state.generateResult?.code || ''}
                  state={actions.getCodeDisplayState()}
                  errorMessage={state.generateResult?.error}
                  title="GENERATED OBSERVER CODE"
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

      {/* API Key Prompt */}
      <ApiKeyPrompt
        isOpen={llmAccess.showPrompt}
        userTier={llmAccess.userTier}
        onConfigure={llmAccess.openSettings}
        onUpgrade={llmAccess.triggerUpgrade}
        onLogin={llmAccess.triggerLogin}
        onDismiss={llmAccess.closePrompt}
      />

      {/* Naming Dialog */}
      <NamingDialog
        visible={state.namingDialogVisible}
        contextData={{ algorithm: 'Market Observer' }}
        onConfirm={actions.handleConfirmNaming}
        onCancel={actions.handleCancelNaming}
      />
    </div>
  );
};

export default MarketObserverPage;

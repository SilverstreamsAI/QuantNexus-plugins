/**
 * BacktestResultPanel Component (component9)
 *
 * TICKET_152: Backtest Result Display
 * TICKET_358: Refactored to slim orchestrator using tab registry
 *
 * Displays backtest results with Charts/Trades/Compare tabs.
 * Uses ExecutorResult from V3 architecture.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { ExecutorResult, WorkflowTimeframes } from './types';
import { getVisibleTabs, isTabDisabled } from './tab-registry';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface BacktestResultPanelProps {
  /** TICKET_151: Support single result (legacy) or array of results for comparison */
  result?: ExecutorResult;
  results?: ExecutorResult[];
  className?: string;
  /** TICKET_151_1: Execution state for Charts stacking and Compare tab behavior */
  isExecuting?: boolean;
  currentCaseIndex?: number;
  totalCases?: number;
  onCaseSelect?: (index: number) => void;
  /** TICKET_151_1: Index to scroll to when user clicks case in History panel */
  scrollToCase?: number;
  /** TICKET_231: Number of bars processed so far (for gray-to-color transition) */
  processedBars?: number;
  /** TICKET_231: Total bars in backtest (for gray-to-color transition) */
  backtestTotalBars?: number;
  /** TICKET_257: Workflow timeframes for display in tab header */
  workflowTimeframes?: WorkflowTimeframes;
  /** TICKET_267: Export to Quant Lab */
  isQuantLabAvailable?: boolean;
  isQuantLabLoading?: boolean;
  isExporting?: boolean;
  onExportToQuantLab?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const BacktestResultPanel: React.FC<BacktestResultPanelProps> = ({
  result,
  results = [],
  className,
  isExecuting = false,
  currentCaseIndex = 0,
  totalCases = 0,
  scrollToCase,
  processedBars = 0,
  backtestTotalBars = 0,
  workflowTimeframes,
}) => {
  const { t } = useTranslation('backtest');
  const [activeTab, setActiveTab] = useState('charts');

  // TICKET_151_2: Refs for scrolling in both Charts and Trades tabs
  const scrollToChartsCaseRef = React.useRef<((index: number) => void) | null>(null);
  const scrollToTradesCaseRef = React.useRef<((index: number) => void) | null>(null);
  const lastScrollToCaseRef = useRef<number | undefined>(undefined);

  // TICKET_151_2: Scroll to case in active tab when scrollToCase prop changes
  useEffect(() => {
    if (scrollToCase !== undefined && scrollToCase >= 0 && scrollToCase !== lastScrollToCaseRef.current) {
      lastScrollToCaseRef.current = scrollToCase;
      setTimeout(() => {
        if (activeTab === 'charts') {
          scrollToChartsCaseRef.current?.(scrollToCase);
        } else if (activeTab === 'trades') {
          scrollToTradesCaseRef.current?.(scrollToCase);
        }
      }, 100);
    }
  }, [scrollToCase, activeTab]);

  // TICKET_151: Support both single result and results array
  const allResults: ExecutorResult[] = results.length > 0
    ? results
    : (result ? [result] : []);

  // TICKET_302: Empty Structure pattern
  if (allResults.length === 0 && !isExecuting) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-color-terminal-text-muted">{t('resultPanel.status.noResults')}</div>
      </div>
    );
  }

  // TICKET_302: When executing but no data yet, use empty result for chart structure
  const effectiveResults: ExecutorResult[] = allResults.length > 0
    ? allResults
    : [{
        success: true,
        startTime: 0,
        endTime: 0,
        executionTimeMs: 0,
        metrics: {
          totalPnl: 0,
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          profitFactor: 0,
        },
        equityCurve: [],
        trades: [],
        candles: [],
      }];

  const hasMultipleResults = effectiveResults.length > 1;

  // TICKET_358: Registry-driven tabs
  const tabs = getVisibleTabs({ hasMultipleResults });
  const disabledCtx = { isExecuting, hasMultipleResults };

  // Find active tab definition
  const activeTabDef = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  // Resolve scrollToCaseRef based on active tab
  const activeScrollRef = activeTab === 'charts'
    ? scrollToChartsCaseRef
    : activeTab === 'trades'
      ? scrollToTradesCaseRef
      : undefined;

  return (
    <div className={cn('flex flex-col h-full border border-color-terminal-border rounded-lg bg-color-terminal-panel/30', className)}>
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-color-terminal-border">
        {/* Left: Tab Buttons */}
        <div className="flex">
          {tabs.map((tab) => {
            const disabled = isTabDisabled(tab, disabledCtx);
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setActiveTab(tab.id)}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors border-b-2',
                  activeTabDef.id === tab.id
                    ? 'border-color-terminal-accent-gold text-color-terminal-accent-gold'
                    : 'border-transparent text-color-terminal-text-muted hover:text-color-terminal-text',
                  disabled && 'opacity-50 cursor-not-allowed hover:text-color-terminal-text-muted'
                )}
              >
                {tab.icon}
                {t(tab.label)}
              </button>
            );
          })}
        </div>

        {/* Right: TICKET_257 Workflow Timeframe Buttons */}
        {workflowTimeframes && (
          <div className="flex items-center gap-1.5 pr-4">
            {/* Market Analysis */}
            <button
              disabled={!workflowTimeframes.analysis}
              className={cn(
                'px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all',
                workflowTimeframes.analysis
                  ? 'border-[#64ffda] bg-[#64ffda]/10 text-[#64ffda]'
                  : 'border-color-terminal-border bg-color-terminal-surface/50 text-color-terminal-text-muted cursor-not-allowed opacity-50'
              )}
            >
              {workflowTimeframes.analysis || '-'}
            </button>
            <span className="text-[9px] text-color-terminal-text-muted uppercase tracking-wider">
              {t('workflowSteps.marketAnalysis')}
            </span>

            <span className="mx-1 text-color-terminal-border">|</span>

            {/* Entry Filter */}
            <button
              disabled={!workflowTimeframes.entryFilter}
              className={cn(
                'px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all',
                workflowTimeframes.entryFilter
                  ? 'border-[#a78bfa] bg-[#a78bfa]/10 text-[#a78bfa]'
                  : 'border-color-terminal-border bg-color-terminal-surface/50 text-color-terminal-text-muted cursor-not-allowed opacity-50'
              )}
            >
              {workflowTimeframes.entryFilter || '-'}
            </button>
            <span className="text-[9px] text-color-terminal-text-muted uppercase tracking-wider">
              {t('workflowSteps.entryFilter')}
            </span>

            <span className="mx-1 text-color-terminal-border">|</span>

            {/* Entry Signal */}
            <button
              disabled={!workflowTimeframes.entrySignal}
              className={cn(
                'px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all',
                workflowTimeframes.entrySignal
                  ? 'border-[#60a5fa] bg-[#60a5fa]/10 text-[#60a5fa]'
                  : 'border-color-terminal-border bg-color-terminal-surface/50 text-color-terminal-text-muted cursor-not-allowed opacity-50'
              )}
            >
              {workflowTimeframes.entrySignal || '-'}
            </button>
            <span className="text-[9px] text-color-terminal-text-muted uppercase tracking-wider">
              {t('workflowSteps.entrySignal')}
            </span>

            <span className="mx-1 text-color-terminal-border">|</span>

            {/* Exit Strategy */}
            <button
              disabled={!workflowTimeframes.exitStrategy}
              className={cn(
                'px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border transition-all',
                workflowTimeframes.exitStrategy
                  ? 'border-[#fbbf24] bg-[#fbbf24]/10 text-[#fbbf24]'
                  : 'border-color-terminal-border bg-color-terminal-surface/50 text-color-terminal-text-muted cursor-not-allowed opacity-50'
              )}
            >
              {workflowTimeframes.exitStrategy || '-'}
            </button>
            <span className="text-[9px] text-color-terminal-text-muted uppercase tracking-wider">
              {t('workflowSteps.exitStrategy')}
            </span>

          </div>
        )}

        {/* TICKET_267: Export button moved to BacktestResultPage footer */}
      </div>

      {/* Tab Content - TICKET_358: Registry-driven rendering */}
      <div className="flex-1 overflow-hidden">
        {activeTabDef && (
          <activeTabDef.component
            results={effectiveResults}
            currentCaseIndex={currentCaseIndex}
            isExecuting={isExecuting}
            totalCases={totalCases}
            scrollToCaseRef={activeScrollRef}
            processedBars={processedBars}
            backtestTotalBars={backtestTotalBars}
          />
        )}
      </div>
    </div>
  );
};

export default BacktestResultPanel;

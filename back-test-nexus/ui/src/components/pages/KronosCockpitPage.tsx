/**
 * KronosCockpitPage Component (page42)
 *
 * Kronos time-series backtest cockpit page.
 * Displays Kronos-generated strategies for backtesting.
 *
 * @see TICKET_077_1 - Page Hierarchy (page42)
 * @see TICKET_077_18 - BacktestHistorySidebar component
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  BacktestHistorySidebar,
  type BacktestHistoryItem,
} from '../ui';
import { algorithmService, type Algorithm } from '../../services/algorithmService';

// -----------------------------------------------------------------------------
// Inline SVG Icons
// -----------------------------------------------------------------------------

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4" />
    <path d="m16.2 7.8 2.9-2.9" />
    <path d="M18 12h4" />
    <path d="m16.2 16.2 2.9 2.9" />
    <path d="M12 18v4" />
    <path d="m4.9 19.1 2.9-2.9" />
    <path d="M2 12h4" />
    <path d="m4.9 4.9 2.9 2.9" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface KronosCockpitPageProps {
  /** API reference for executor operations */
  executorAPI?: any;
  /** API reference for data operations */
  dataAPI?: any;
  /** API reference for message display */
  messageAPI?: any;
  /** Callback when result view state changes */
  onResultViewChange?: (isResultView: boolean) => void;
  /** Reset key to trigger state clear */
  resetKey?: number;
}

// -----------------------------------------------------------------------------
// Strategy Type Labels
// -----------------------------------------------------------------------------

const STRATEGY_TYPE_LABELS: Record<number, string> = {
  9: 'Detector',
  3: 'Entry',
  0: 'Signal',
  1: 'Filter',
  2: 'Exit',
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const KronosCockpitPage: React.FC<KronosCockpitPageProps> = ({
  executorAPI,
  dataAPI,
  messageAPI,
  onResultViewChange,
  resetKey,
}) => {
  const { t } = useTranslation('backtest');

  // State
  const [kronosAlgorithms, setKronosAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // History sidebar state (empty for now - future implementation)
  const [historyItems] = useState<BacktestHistoryItem[]>([]);
  const [historyLoading] = useState(false);

  // Load Kronos algorithms on mount
  useEffect(() => {
    const loadAlgorithms = async () => {
      setLoading(true);
      try {
        const algorithms = await algorithmService.getKronosAlgorithms();
        setKronosAlgorithms(algorithms);
      } catch (error) {
        console.error('[KronosCockpitPage] Failed to load algorithms:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlgorithms();
  }, [resetKey]);

  // Handle algorithm selection
  const handleSelectAlgorithm = useCallback((algorithm: Algorithm) => {
    setSelectedAlgorithm(prev =>
      prev?.id === algorithm.id ? null : algorithm
    );
  }, []);

  // Handle execute button click
  const handleExecute = useCallback(async () => {
    if (!selectedAlgorithm) {
      messageAPI?.showToast?.({
        type: 'warning',
        message: t('kronos.selectAlgorithmFirst'),
      });
      return;
    }

    setIsExecuting(true);
    try {
      // TODO: Implement Kronos strategy execution
      console.log('[KronosCockpitPage] Execute algorithm:', selectedAlgorithm);
      messageAPI?.showToast?.({
        type: 'info',
        message: t('kronos.executionStarted'),
      });
    } catch (error) {
      console.error('[KronosCockpitPage] Execution failed:', error);
      messageAPI?.showToast?.({
        type: 'error',
        message: t('kronos.executionFailed'),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedAlgorithm, messageAPI, t]);

  // Sidebar handlers (placeholders for future implementation)
  const handleHistoryItemClick = useCallback((taskId: string) => {
    console.log('[KronosCockpitPage] History item clicked:', taskId);
  }, []);

  const handleDeleteClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    console.log('[KronosCockpitPage] Delete clicked:', itemId);
  }, []);

  const handleCaseClick = useCallback((index: number) => {
    console.log('[KronosCockpitPage] Case clicked:', index);
  }, []);

  return (
    <div className="h-full flex bg-color-terminal-bg text-color-terminal-text">
      {/* Zone B: History Sidebar - Reusing component18 */}
      <BacktestHistorySidebar
        isExecuting={isExecuting}
        currentCaseIndex={0}
        totalCases={0}
        resultsCount={0}
        historyItems={historyItems}
        historyLoading={historyLoading}
        onHistoryItemClick={handleHistoryItemClick}
        onDeleteClick={handleDeleteClick}
        onCaseClick={handleCaseClick}
      />

      {/* Zone C + Zone D */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Zone C: Kronos Strategy List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Title */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg border border-color-terminal-accent-gold/30 bg-color-terminal-accent-gold/10">
              <ClockIcon className="w-5 h-5 text-color-terminal-accent-gold" />
            </div>
            <div>
              <h2 className="text-sm font-black terminal-mono uppercase tracking-[0.15em] text-white">
                {t('kronos.title')}
              </h2>
              <p className="text-[10px] text-color-terminal-text-muted">
                {t('kronos.subtitle')}
              </p>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoaderIcon className="w-8 h-8 text-color-terminal-text-muted animate-spin" />
            </div>
          ) : kronosAlgorithms.length === 0 ? (
            <EmptyState />
          ) : (
            <StrategyTable
              algorithms={kronosAlgorithms}
              selectedId={selectedAlgorithm?.id ?? null}
              onSelect={handleSelectAlgorithm}
            />
          )}
        </div>

        {/* Zone D: Action Bar */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-color-terminal-border bg-color-terminal-panel/30">
          <button
            onClick={handleExecute}
            disabled={!selectedAlgorithm || isExecuting}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg',
              'text-sm font-bold uppercase tracking-wider transition-all duration-200',
              selectedAlgorithm && !isExecuting
                ? 'bg-color-terminal-accent-gold text-color-terminal-bg hover:bg-color-terminal-accent-gold/90 shadow-glow-gold'
                : 'bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed'
            )}
          >
            {isExecuting ? (
              <>
                <LoaderIcon className="w-4 h-4 animate-spin" />
                <span>{t('kronos.executing')}</span>
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                <span>{t('kronos.execute')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

const EmptyState: React.FC = () => {
  const { t } = useTranslation('backtest');

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ClockIcon className="w-12 h-12 text-color-terminal-text-muted/50 mb-4" />
      <h3 className="text-sm font-bold text-color-terminal-text-secondary mb-2">
        {t('kronos.noStrategies')}
      </h3>
      <p className="text-[11px] text-color-terminal-text-muted max-w-xs">
        {t('kronos.noStrategiesHint')}
      </p>
    </div>
  );
};

interface StrategyTableProps {
  algorithms: Algorithm[];
  selectedId: number | null;
  onSelect: (algorithm: Algorithm) => void;
}

const StrategyTable: React.FC<StrategyTableProps> = ({
  algorithms,
  selectedId,
  onSelect,
}) => {
  const { t } = useTranslation('backtest');

  return (
    <div className="border border-color-terminal-border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[1fr_100px_120px_60px] gap-4 px-4 py-3 bg-color-terminal-surface/50 border-b border-color-terminal-border">
        <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
          {t('kronos.columnName')}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
          {t('kronos.columnType')}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
          {t('kronos.columnCreated')}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary text-center">
          {t('kronos.columnAction')}
        </span>
      </div>

      {/* Table Body */}
      <div className="max-h-[400px] overflow-y-auto">
        {algorithms.map((algo) => (
          <div
            key={algo.id}
            onClick={() => onSelect(algo)}
            className={cn(
              'grid grid-cols-[1fr_100px_120px_60px] gap-4 px-4 py-3 cursor-pointer transition-colors',
              'border-b border-color-terminal-border last:border-b-0',
              selectedId === algo.id
                ? 'bg-color-terminal-accent-gold/10 border-l-2 border-l-color-terminal-accent-gold'
                : 'hover:bg-white/5'
            )}
          >
            {/* Strategy Name */}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-color-terminal-text truncate">
                {algo.strategyName}
              </span>
              {algo.description && (
                <span className="text-[10px] text-color-terminal-text-muted truncate">
                  {algo.description}
                </span>
              )}
            </div>

            {/* Strategy Type */}
            <div className="flex items-center">
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border',
                'bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal border-color-terminal-accent-teal/30'
              )}>
                {STRATEGY_TYPE_LABELS[algo.strategyType] || `Type ${algo.strategyType}`}
              </span>
            </div>

            {/* Created Date (placeholder - would need actual timestamp) */}
            <div className="flex items-center text-[11px] text-color-terminal-text-muted">
              -
            </div>

            {/* Action */}
            <div className="flex items-center justify-center">
              <div className={cn(
                'w-4 h-4 rounded-full border-2 transition-colors',
                selectedId === algo.id
                  ? 'border-color-terminal-accent-gold bg-color-terminal-accent-gold'
                  : 'border-color-terminal-border'
              )} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KronosCockpitPage;

/**
 * BacktestPage Component - Plugin Layer
 *
 * Backtest Nexus page following TICKET_077 layout specification.
 * Zones: B (Sidebar - History), C (WorkflowRowSelector), D (Action Bar - Execute)
 *
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { WorkflowRowSelector, type WorkflowRow, type AlgorithmOption } from '../ui';

// Inline SVG icons
const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HistoryItem {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'failed' | 'running';
}

interface BacktestPageProps {
  onExecute?: () => void;
}

// -----------------------------------------------------------------------------
// Mock Algorithm Data (will be replaced with SQLite query)
// -----------------------------------------------------------------------------

const MOCK_ALGORITHMS: {
  trendRange: AlgorithmOption[];
  preCondition: AlgorithmOption[];
  selectSteps: AlgorithmOption[];
  postCondition: AlgorithmOption[];
} = {
  trendRange: [
    { id: 1, code: 'TR001', strategyName: 'Trend Following', strategyType: 9, description: 'Follow market trends' },
    { id: 2, code: 'TR002', strategyName: 'Range Trading', strategyType: 9, description: 'Trade within price ranges' },
    { id: 3, code: 'TR003', strategyName: 'Momentum Analysis', strategyType: 9, description: 'Analyze momentum indicators' },
    { id: 4, code: 'TR004', strategyName: 'Mean Reversion', strategyType: 9, description: 'Trade mean reversion patterns' },
  ],
  preCondition: [
    { id: 10, code: 'PRE001', strategyName: 'Volume Filter', strategyType: 4, description: 'Minimum volume requirement' },
    { id: 11, code: 'PRE002', strategyName: 'Volatility Check', strategyType: 4, description: 'Volatility threshold' },
    { id: 12, code: 'PRE003', strategyName: 'Trend Confirmation', strategyType: 4, description: 'Confirm trend direction' },
  ],
  selectSteps: [
    { id: 20, code: 'SS001', strategyName: 'MA Crossover', strategyType: 0, description: 'Moving average crossover' },
    { id: 21, code: 'SS002', strategyName: 'RSI Entry', strategyType: 1, description: 'RSI-based entry signal' },
    { id: 22, code: 'SS003', strategyName: 'MACD Signal', strategyType: 2, description: 'MACD histogram signal' },
    { id: 23, code: 'SS004', strategyName: 'Bollinger Breakout', strategyType: 3, description: 'Bollinger band breakout' },
    { id: 24, code: 'SS005', strategyName: 'Volume Spike', strategyType: 1, description: 'Volume increase detection' },
    { id: 25, code: 'SS006', strategyName: 'Support/Resistance', strategyType: 2, description: 'S/R level detection' },
  ],
  postCondition: [
    { id: 30, code: 'POST001', strategyName: 'Stop Loss', strategyType: 6, description: 'Fixed stop loss' },
    { id: 31, code: 'POST002', strategyName: 'Take Profit', strategyType: 6, description: 'Fixed take profit' },
    { id: 32, code: 'POST003', strategyName: 'Trailing Stop', strategyType: 6, description: 'Trailing stop loss' },
  ],
};

// Initial empty row
const createInitialRow = (): WorkflowRow => ({
  id: `row-${Date.now()}`,
  rowNumber: 1,
  analysisSelections: [],
  preConditionSelections: [],
  stepSelections: [],
  postConditionSelections: [],
});

// -----------------------------------------------------------------------------
// BacktestPage Component
// -----------------------------------------------------------------------------

export const BacktestPage: React.FC<BacktestPageProps> = ({
  onExecute,
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [historyItems] = useState<HistoryItem[]>([]);
  const [workflowRows, setWorkflowRows] = useState<WorkflowRow[]>([createInitialRow()]);

  const handleExecute = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      onExecute?.();
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, onExecute]);

  return (
    <div className="h-full flex bg-color-terminal-bg text-color-terminal-text">
      {/* Zone B: History Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-color-terminal-border bg-color-terminal-panel/30 flex flex-col">
        <div className="px-4 py-3 border-b border-color-terminal-border">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-color-terminal-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
              History
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {historyItems.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <HistoryIcon className="w-8 h-8 mx-auto mb-3 text-color-terminal-text-muted opacity-50" />
              <p className="text-[11px] text-color-terminal-text-muted">
                No backtest history
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-full px-3 py-2 text-left rounded transition-colors",
                    "hover:bg-white/5"
                  )}
                >
                  <div className="text-xs font-medium text-color-terminal-text truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-color-terminal-text-muted">
                    {item.date}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone C + Zone D */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Zone C: WorkflowRowSelector */}
        <div className="flex-1 overflow-y-auto p-6">
          <WorkflowRowSelector
            title="WORKFLOW CONFIGURATION"
            rows={workflowRows}
            onChange={setWorkflowRows}
            algorithms={MOCK_ALGORITHMS}
            maxRows={10}
          />
        </div>

        {/* Zone D: Action Bar */}
        <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all",
              isExecuting
                ? "border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed"
                : "border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20"
            )}
          >
            {isExecuting ? (
              <>
                <LoaderIcon className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BacktestPage;

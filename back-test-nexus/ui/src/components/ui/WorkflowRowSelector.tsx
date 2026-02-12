/**
 * WorkflowRowSelector Component (component7)
 *
 * Algorithm workflow builder for Zone C variable content area.
 * Displays a row of 4 algorithm selection buttons with stage-level timeframe:
 * - Select Algorithm (Trend-Range) + Timeframe
 * - Pre-condition + Timeframe
 * - Select Steps + Timeframe
 * - Post-condition + Timeframe
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_248 - Stage-Level Timeframe Selector
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { WorkflowDropdown, type AlgorithmOption, type ColorTheme } from './WorkflowDropdown';
import { TimeframeDropdown, type TimeframeValue } from './TimeframeDropdown';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** TICKET_248: Algorithm selection with stage-level timeframe */
export interface AlgorithmSelection {
  id: number;
  code: string;
  strategyName: string;
  strategyType: number;
  description?: string;
  /** TICKET_248: Stage-level timeframe for this algorithm */
  timeframe: TimeframeValue;
}

export interface WorkflowRow {
  id: string;
  rowNumber: number;
  analysisSelections: AlgorithmSelection[];
  preConditionSelections: AlgorithmSelection[];
  stepSelections: AlgorithmSelection[];
  postConditionSelections: AlgorithmSelection[];
}

export interface WorkflowRowSelectorProps {
  /** Component title */
  title?: string;
  /** Current workflow rows data */
  rows: WorkflowRow[];
  /** Callback when rows change */
  onChange: (rows: WorkflowRow[]) => void;
  /** Available algorithms grouped by type */
  algorithms: {
    trendRange: AlgorithmOption[];
    preCondition: AlgorithmOption[];
    selectSteps: AlgorithmOption[];
    postCondition: AlgorithmOption[];
  };
  /** Maximum number of rows */
  maxRows?: number;
  /** Permanently disable Pre-condition and Post-condition buttons */
  disableConditions?: boolean;
  /** TICKET_077_20: Permanently disable Market Analysis button (for Trader cockpit) */
  disableAnalysis?: boolean;
  /** TICKET_305: Restrict timeframe options to provider-supported intervals */
  allowedIntervals?: TimeframeValue[];
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default timeframe for new selections */
const DEFAULT_TIMEFRAME: TimeframeValue = '1d';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

const createEmptyRow = (rowNumber: number): WorkflowRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  rowNumber,
  analysisSelections: [],
  preConditionSelections: [],
  stepSelections: [],
  postConditionSelections: [],
});

const hasContent = (row: WorkflowRow): boolean => {
  return (
    row.analysisSelections.length > 0 ||
    row.preConditionSelections.length > 0 ||
    row.stepSelections.length > 0 ||
    row.postConditionSelections.length > 0
  );
};

// -----------------------------------------------------------------------------
// Selection Chips Component (with timeframe display)
// -----------------------------------------------------------------------------

interface SelectionChipsProps {
  selections: AlgorithmSelection[];
  onRemove: (id: number) => void;
  onTimeframeChange: (id: number, timeframe: TimeframeValue) => void;
  theme: ColorTheme;
  disabled?: boolean;
  /** TICKET_305: Restrict timeframe options */
  allowedIntervals?: TimeframeValue[];
}

const SelectionChips: React.FC<SelectionChipsProps> = ({
  selections,
  onRemove,
  onTimeframeChange,
  theme,
  disabled,
  allowedIntervals,
}) => {
  if (selections.length === 0) return null;

  const themeClasses: Record<ColorTheme, string> = {
    teal: 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30',
    purple: 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30',
    blue: 'bg-[#60a5fa]/10 text-[#60a5fa] border-[#60a5fa]/30',
    gold: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30',
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {selections.map((sel) => (
        <div
          key={sel.id}
          className={cn(
            'inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 text-[10px] rounded border',
            themeClasses[theme]
          )}
        >
          {/* Inline timeframe selector */}
          <TimeframeDropdown
            value={sel.timeframe}
            onChange={(tf) => onTimeframeChange(sel.id, tf)}
            allowedValues={allowedIntervals}
            theme={theme}
            disabled={disabled}
            className="!min-w-[40px] !px-1 !py-0.5 !text-[9px] !border-0 !bg-transparent"
          />
          <span className="truncate max-w-[80px]">{sel.strategyName}</span>
          <button
            onClick={() => onRemove(sel.id)}
            className="hover:opacity-70 transition-opacity"
            disabled={disabled}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Algorithm Selector with Timeframe
// -----------------------------------------------------------------------------

interface AlgorithmSelectorWithTimeframeProps {
  label: string;
  options: AlgorithmOption[];
  selections: AlgorithmSelection[];
  onSelectionsChange: (selections: AlgorithmSelection[]) => void;
  theme: ColorTheme;
  disabled?: boolean;
  multiSelect?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Current timeframe for new selections */
  defaultTimeframe: TimeframeValue;
  onDefaultTimeframeChange: (timeframe: TimeframeValue) => void;
  /** TICKET_305: Restrict timeframe options */
  allowedIntervals?: TimeframeValue[];
}

const AlgorithmSelectorWithTimeframe: React.FC<AlgorithmSelectorWithTimeframeProps> = ({
  label,
  options,
  selections,
  onSelectionsChange,
  theme,
  disabled = false,
  multiSelect = true,
  showSearch = true,
  searchPlaceholder,
  defaultTimeframe,
  onDefaultTimeframeChange,
  allowedIntervals,
}) => {
  // Handle algorithm selection change
  const handleAlgorithmChange = useCallback((selectedIds: number[]) => {
    // Find newly added IDs
    const existingIds = new Set(selections.map(s => s.id));
    const newSelections: AlgorithmSelection[] = [];

    for (const id of selectedIds) {
      if (existingIds.has(id)) {
        // Keep existing selection with its timeframe
        const existing = selections.find(s => s.id === id);
        if (existing) {
          newSelections.push(existing);
        }
      } else {
        // Add new selection with default timeframe
        const option = options.find(o => o.id === id);
        if (option) {
          newSelections.push({
            id: option.id,
            code: option.code,
            strategyName: option.strategyName,
            strategyType: option.strategyType,
            description: option.description,
            timeframe: defaultTimeframe,
          });
        }
      }
    }

    onSelectionsChange(newSelections);
  }, [selections, options, defaultTimeframe, onSelectionsChange]);

  // Handle chip removal
  const handleRemoveChip = useCallback((id: number) => {
    onSelectionsChange(selections.filter(s => s.id !== id));
  }, [selections, onSelectionsChange]);

  // Handle timeframe change for a specific selection
  const handleTimeframeChange = useCallback((id: number, timeframe: TimeframeValue) => {
    onSelectionsChange(
      selections.map(s => s.id === id ? { ...s, timeframe } : s)
    );
  }, [selections, onSelectionsChange]);

  return (
    <div className="flex flex-col">
      {/* Row: Timeframe + Algorithm Dropdown */}
      <div className="flex items-stretch gap-1">
        {/* Timeframe selector (for new selections) */}
        <TimeframeDropdown
          value={defaultTimeframe}
          onChange={onDefaultTimeframeChange}
          allowedValues={allowedIntervals}
          theme={theme}
          disabled={disabled}
        />
        {/* Algorithm dropdown */}
        <WorkflowDropdown
          label={label}
          options={options}
          selectedIds={selections.map(s => s.id)}
          onChange={handleAlgorithmChange}
          theme={theme}
          disabled={disabled}
          multiSelect={multiSelect}
          showSearch={showSearch}
          searchPlaceholder={searchPlaceholder}
          className="flex-1"
        />
      </div>
      {/* Selection chips with inline timeframe */}
      <SelectionChips
        selections={selections}
        onRemove={handleRemoveChip}
        onTimeframeChange={handleTimeframeChange}
        theme={theme}
        disabled={disabled}
        allowedIntervals={allowedIntervals}
      />
    </div>
  );
};

// -----------------------------------------------------------------------------
// Single Workflow Row Component
// -----------------------------------------------------------------------------

interface WorkflowRowItemProps {
  row: WorkflowRow;
  algorithms: WorkflowRowSelectorProps['algorithms'];
  onUpdate: (rowId: string, updates: Partial<WorkflowRow>) => void;
  disableConditions?: boolean;
  disableAnalysis?: boolean;
  t: (key: string) => string;
  /** TICKET_305: Restrict timeframe options */
  allowedIntervals?: TimeframeValue[];
}

const WorkflowRowItem: React.FC<WorkflowRowItemProps> = ({
  row,
  algorithms,
  onUpdate,
  disableConditions,
  disableAnalysis,
  t,
  allowedIntervals,
}) => {
  // TICKET_248: Track default timeframe for each column (used when adding new selections)
  // TICKET_257: Different defaults for different stages (regime=1d, entry/exit=1h)
  const [defaultTimeframes, setDefaultTimeframes] = useState<{
    analysis: TimeframeValue;
    preCondition: TimeframeValue;
    steps: TimeframeValue;
    postCondition: TimeframeValue;
  }>({
    analysis: '1d',      // Regime detection typically on higher timeframe
    preCondition: '1h',  // Entry filter on lower timeframe
    steps: '1h',         // Entry signal on lower timeframe
    postCondition: '1h', // Exit on lower timeframe
  });

  const handleSelectionsChange = useCallback((
    column: 'analysis' | 'preCondition' | 'steps' | 'postCondition',
    selections: AlgorithmSelection[]
  ) => {
    const updateKey = {
      analysis: 'analysisSelections',
      preCondition: 'preConditionSelections',
      steps: 'stepSelections',
      postCondition: 'postConditionSelections',
    }[column] as keyof WorkflowRow;

    onUpdate(row.id, { [updateKey]: selections });
  }, [row.id, onUpdate]);

  const handleDefaultTimeframeChange = useCallback((
    column: 'analysis' | 'preCondition' | 'steps' | 'postCondition',
    timeframe: TimeframeValue
  ) => {
    setDefaultTimeframes(prev => ({ ...prev, [column]: timeframe }));
  }, []);

  // Pre-condition (Entry Filter):
  // - If disableAnalysis is true (trader mode), always enabled (independent of Market Analysis)
  // - Otherwise, enabled when algorithm is selected (respects disableConditions)
  const preConditionEnabled = disableAnalysis ? true : (disableConditions ? false : row.analysisSelections.length > 0);
  // Post-condition: enabled when step is selected (independent of disableConditions)
  const postConditionEnabled = row.stepSelections.length > 0;

  return (
    <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface/20 p-4 mb-4">
      {/* Row Number */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 flex items-center justify-center rounded bg-color-terminal-surface text-xs font-bold text-color-terminal-text-muted">
          {row.rowNumber}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted">
          {t('page.workflowStep')}
        </span>
      </div>

      {/* 4 Columns: [TF][Algorithm] for each */}
      <div className="flex flex-row gap-3 w-full">
        {/* Select Algorithm (Market Analysis) - wide (3 units) */}
        <div className="flex-[3]">
          <AlgorithmSelectorWithTimeframe
            label={t('workflowSelector.selectAlgorithm')}
            options={algorithms.trendRange}
            selections={row.analysisSelections}
            onSelectionsChange={(sel) => handleSelectionsChange('analysis', sel)}
            theme="teal"
            disabled={disableAnalysis}
            multiSelect={true}
            showSearch={true}
            searchPlaceholder={t('workflowSelector.search')}
            defaultTimeframe={defaultTimeframes.analysis}
            onDefaultTimeframeChange={(tf) => handleDefaultTimeframeChange('analysis', tf)}
            allowedIntervals={allowedIntervals}
          />
        </div>

        {/* Pre-condition - narrow (2 units) */}
        <div className="flex-[2]">
          <AlgorithmSelectorWithTimeframe
            label={t('workflowSelector.preCondition')}
            options={algorithms.preCondition}
            selections={row.preConditionSelections}
            onSelectionsChange={(sel) => handleSelectionsChange('preCondition', sel)}
            theme="purple"
            disabled={!preConditionEnabled}
            multiSelect={false}
            showSearch={false}
            defaultTimeframe={defaultTimeframes.preCondition}
            onDefaultTimeframeChange={(tf) => handleDefaultTimeframeChange('preCondition', tf)}
            allowedIntervals={allowedIntervals}
          />
        </div>

        {/* Select Steps - wide (3 units) */}
        <div className="flex-[3]">
          <AlgorithmSelectorWithTimeframe
            label={t('workflowSelector.selectSteps')}
            options={algorithms.selectSteps}
            selections={row.stepSelections}
            onSelectionsChange={(sel) => handleSelectionsChange('steps', sel)}
            theme="blue"
            multiSelect={true}
            showSearch={true}
            searchPlaceholder={t('workflowSelector.search')}
            defaultTimeframe={defaultTimeframes.steps}
            onDefaultTimeframeChange={(tf) => handleDefaultTimeframeChange('steps', tf)}
            allowedIntervals={allowedIntervals}
          />
        </div>

        {/* Post-condition - narrow (2 units) */}
        <div className="flex-[2]">
          <AlgorithmSelectorWithTimeframe
            label={t('workflowSelector.postCondition')}
            options={algorithms.postCondition}
            selections={row.postConditionSelections}
            onSelectionsChange={(sel) => handleSelectionsChange('postCondition', sel)}
            theme="gold"
            disabled={!postConditionEnabled}
            multiSelect={false}
            showSearch={false}
            defaultTimeframe={defaultTimeframes.postCondition}
            onDefaultTimeframeChange={(tf) => handleDefaultTimeframeChange('postCondition', tf)}
            allowedIntervals={allowedIntervals}
          />
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// WorkflowRowSelector Component
// -----------------------------------------------------------------------------

export const WorkflowRowSelector: React.FC<WorkflowRowSelectorProps> = ({
  title,
  rows,
  onChange,
  algorithms,
  maxRows = 10,
  disableConditions = false,
  disableAnalysis = false,
  allowedIntervals,
  className,
}) => {
  const { t } = useTranslation('backtest');
  const displayTitle = title || t('page.workflowTitle');

  const updateRow = useCallback(
    (rowId: string, updates: Partial<WorkflowRow>) => {
      const newRows = rows.map((row) =>
        row.id === rowId ? { ...row, ...updates } : row
      );

      // Auto-add new row if last row has content
      const lastRow = newRows[newRows.length - 1];
      if (lastRow && hasContent(lastRow) && newRows.length < maxRows) {
        newRows.push(createEmptyRow(newRows.length + 1));
      }

      // Remove trailing empty rows (keep at least one)
      while (newRows.length > 1 && !hasContent(newRows[newRows.length - 1])) {
        const secondLast = newRows[newRows.length - 2];
        if (!hasContent(secondLast)) {
          newRows.pop();
        } else {
          break;
        }
      }

      onChange(newRows);
    },
    [rows, onChange, maxRows]
  );

  return (
    <div className={cn('workflow-row-selector w-full', className)}>
      {/* Title */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {displayTitle}
      </h2>

      {/* Workflow Rows */}
      {rows.map((row) => (
        <WorkflowRowItem
          key={row.id}
          row={row}
          algorithms={algorithms}
          onUpdate={updateRow}
          disableConditions={disableConditions}
          disableAnalysis={disableAnalysis}
          t={t}
          allowedIntervals={allowedIntervals}
        />
      ))}
    </div>
  );
};

export default WorkflowRowSelector;

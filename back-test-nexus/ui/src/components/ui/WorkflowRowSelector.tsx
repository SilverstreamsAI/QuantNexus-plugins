/**
 * WorkflowRowSelector Component (component7)
 *
 * Algorithm workflow builder for Zone C variable content area.
 * Displays a row of 4 algorithm selection buttons:
 * - Select Algorithm (Trend-Range)
 * - Pre-condition
 * - Select Steps
 * - Post-condition
 *
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { WorkflowDropdown, type AlgorithmOption } from './WorkflowDropdown';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AlgorithmSelection {
  id: number;
  code: string;
  strategyName: string;
  strategyType: number;
  description?: string;
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
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'WORKFLOW CONFIGURATION';

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
// Selection Chips Component
// -----------------------------------------------------------------------------

interface SelectionChipsProps {
  selections: AlgorithmSelection[];
  onRemove: (id: number) => void;
  theme: 'teal' | 'purple' | 'blue' | 'gold';
}

const SelectionChips: React.FC<SelectionChipsProps> = ({ selections, onRemove, theme }) => {
  if (selections.length === 0) return null;

  const themeClasses = {
    teal: 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/30',
    purple: 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30',
    blue: 'bg-[#60a5fa]/10 text-[#60a5fa] border-[#60a5fa]/30',
    gold: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/30',
  };

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {selections.map((sel) => (
        <span
          key={sel.id}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border',
            themeClasses[theme]
          )}
        >
          <span className="truncate max-w-[100px]">{sel.strategyName}</span>
          <button
            onClick={() => onRemove(sel.id)}
            className="hover:opacity-70 transition-opacity"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
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
}

const WorkflowRowItem: React.FC<WorkflowRowItemProps> = ({ row, algorithms, onUpdate, disableConditions }) => {
  const toSelection = (opt: AlgorithmOption): AlgorithmSelection => ({
    id: opt.id,
    code: opt.code,
    strategyName: opt.strategyName,
    strategyType: opt.strategyType,
    description: opt.description,
  });

  const handleSelectionChange = (
    column: 'analysis' | 'preCondition' | 'steps' | 'postCondition',
    selectedIds: number[],
    availableOptions: AlgorithmOption[]
  ) => {
    const selectedItems = selectedIds
      .map((id) => availableOptions.find((opt) => opt.id === id))
      .filter((opt): opt is AlgorithmOption => opt !== undefined)
      .map(toSelection);

    const updateKey = {
      analysis: 'analysisSelections',
      preCondition: 'preConditionSelections',
      steps: 'stepSelections',
      postCondition: 'postConditionSelections',
    }[column] as keyof WorkflowRow;

    onUpdate(row.id, { [updateKey]: selectedItems });
  };

  const handleRemoveChip = (
    column: 'analysis' | 'preCondition' | 'steps' | 'postCondition',
    selectionId: number
  ) => {
    const columnKey = {
      analysis: 'analysisSelections',
      preCondition: 'preConditionSelections',
      steps: 'stepSelections',
      postCondition: 'postConditionSelections',
    }[column] as keyof WorkflowRow;

    const currentSelections = row[columnKey] as AlgorithmSelection[];
    const newSelections = currentSelections.filter((s) => s.id !== selectionId);
    onUpdate(row.id, { [columnKey]: newSelections });
  };

  // Pre/Post conditions: permanently disabled if disableConditions is true
  const conditionEnabled = disableConditions ? false : row.analysisSelections.length > 0;

  return (
    <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface/20 p-4 mb-4">
      {/* Row Number */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 flex items-center justify-center rounded bg-color-terminal-surface text-xs font-bold text-color-terminal-text-muted">
          {row.rowNumber}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted">
          Workflow Step
        </span>
      </div>

      {/* 4 Buttons in a row - wider for enabled (3), narrower for disabled (2) */}
      <div className="flex flex-row gap-3 w-full">
        {/* Select Algorithm - wide (3 units) */}
        <div className="flex-[3]">
          <WorkflowDropdown
            label="Select Algorithm"
            options={algorithms.trendRange}
            selectedIds={row.analysisSelections.map((s) => s.id)}
            onChange={(ids) => handleSelectionChange('analysis', ids, algorithms.trendRange)}
            theme="teal"
            multiSelect={true}
            showSearch={true}
            searchPlaceholder="Search..."
          />
          <SelectionChips
            selections={row.analysisSelections}
            onRemove={(id) => handleRemoveChip('analysis', id)}
            theme="teal"
          />
        </div>

        {/* Pre-condition - narrow (2 units) */}
        <div className="flex-[2]">
          <WorkflowDropdown
            label="Pre-condition"
            options={algorithms.preCondition}
            selectedIds={row.preConditionSelections.map((s) => s.id)}
            onChange={(ids) => handleSelectionChange('preCondition', ids, algorithms.preCondition)}
            theme="purple"
            disabled={!conditionEnabled}
            multiSelect={false}
            showSearch={false}
          />
          <SelectionChips
            selections={row.preConditionSelections}
            onRemove={(id) => handleRemoveChip('preCondition', id)}
            theme="purple"
          />
        </div>

        {/* Select Steps - wide (3 units) */}
        <div className="flex-[3]">
          <WorkflowDropdown
            label="Select Steps"
            options={algorithms.selectSteps}
            selectedIds={row.stepSelections.map((s) => s.id)}
            onChange={(ids) => handleSelectionChange('steps', ids, algorithms.selectSteps)}
            theme="blue"
            multiSelect={true}
            showSearch={true}
            searchPlaceholder="Search..."
          />
          <SelectionChips
            selections={row.stepSelections}
            onRemove={(id) => handleRemoveChip('steps', id)}
            theme="blue"
          />
        </div>

        {/* Post-condition - narrow (2 units) */}
        <div className="flex-[2]">
          <WorkflowDropdown
            label="Post-condition"
            options={algorithms.postCondition}
            selectedIds={row.postConditionSelections.map((s) => s.id)}
            onChange={(ids) => handleSelectionChange('postCondition', ids, algorithms.postCondition)}
            theme="gold"
            disabled={!conditionEnabled}
            multiSelect={false}
            showSearch={false}
          />
          <SelectionChips
            selections={row.postConditionSelections}
            onRemove={(id) => handleRemoveChip('postCondition', id)}
            theme="gold"
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
  title = DEFAULT_TITLE,
  rows,
  onChange,
  algorithms,
  maxRows = 10,
  disableConditions = false,
  className,
}) => {
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
        {title}
      </h2>

      {/* Workflow Rows */}
      {rows.map((row) => (
        <WorkflowRowItem
          key={row.id}
          row={row}
          algorithms={algorithms}
          onUpdate={updateRow}
          disableConditions={disableConditions}
        />
      ))}
    </div>
  );
};

export default WorkflowRowSelector;

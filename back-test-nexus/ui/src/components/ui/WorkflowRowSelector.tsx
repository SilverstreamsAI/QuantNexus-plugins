/**
 * WorkflowRowSelector Component (component7)
 *
 * Algorithm workflow builder for Zone C variable content area.
 * Displays a table of workflow rows with algorithm selection dropdowns.
 * Data source: SQLite nona_algorithms table.
 *
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useState, useCallback, useMemo } from 'react';
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
    trendRange: AlgorithmOption[];      // type 9
    preCondition: AlgorithmOption[];    // type 4
    selectSteps: AlgorithmOption[];     // types 0,1,2,3
    postCondition: AlgorithmOption[];   // type 6
  };
  /** Maximum number of rows */
  maxRows?: number;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'WORKFLOW CONFIGURATION';
const DEFAULT_MAX_ROWS = 10;

// Column headers
const COLUMN_HEADERS = {
  rowNumber: '#',
  analysis: 'ANALYSIS',
  steps: 'STRATEGY STEPS',
};

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
          <span className="truncate max-w-[120px]">{sel.strategyName}</span>
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
// WorkflowRowSelector Component
// -----------------------------------------------------------------------------

export const WorkflowRowSelector: React.FC<WorkflowRowSelectorProps> = ({
  title = DEFAULT_TITLE,
  rows,
  onChange,
  algorithms,
  maxRows = DEFAULT_MAX_ROWS,
  className,
}) => {
  // Convert AlgorithmOption to AlgorithmSelection
  const toSelection = useCallback((opt: AlgorithmOption): AlgorithmSelection => ({
    id: opt.id,
    code: opt.code,
    strategyName: opt.strategyName,
    strategyType: opt.strategyType,
    description: opt.description,
  }), []);

  // Update a specific row
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

  // Handle selection change for a column
  const handleSelectionChange = useCallback(
    (
      rowId: string,
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

      updateRow(rowId, { [updateKey]: selectedItems });
    },
    [updateRow, toSelection]
  );

  // Handle remove chip
  const handleRemoveChip = useCallback(
    (
      rowId: string,
      column: 'analysis' | 'preCondition' | 'steps' | 'postCondition',
      selectionId: number
    ) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      const columnKey = {
        analysis: 'analysisSelections',
        preCondition: 'preConditionSelections',
        steps: 'stepSelections',
        postCondition: 'postConditionSelections',
      }[column] as keyof WorkflowRow;

      const currentSelections = row[columnKey] as AlgorithmSelection[];
      const newSelections = currentSelections.filter((s) => s.id !== selectionId);

      updateRow(rowId, { [columnKey]: newSelections });
    },
    [rows, updateRow]
  );

  // Check if Pre/Post conditions should be enabled
  const isConditionEnabled = useCallback(
    (row: WorkflowRow): boolean => {
      return row.analysisSelections.length > 0;
    },
    []
  );

  return (
    <div className={cn('workflow-row-selector', className)}>
      {/* Title */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {title}
      </h2>

      {/* Table */}
      <div className="border border-color-terminal-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_2fr] bg-color-terminal-surface/50 border-b border-color-terminal-border">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-muted text-center">
            {COLUMN_HEADERS.rowNumber}
          </div>
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-muted border-l border-color-terminal-border">
            {COLUMN_HEADERS.analysis}
          </div>
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-muted border-l border-color-terminal-border">
            {COLUMN_HEADERS.steps}
          </div>
        </div>

        {/* Rows */}
        {rows.map((row) => {
          const conditionEnabled = isConditionEnabled(row);

          return (
            <div
              key={row.id}
              className="grid grid-cols-[40px_1fr_2fr] border-b border-color-terminal-border last:border-b-0"
            >
              {/* Row Number */}
              <div className="px-3 py-3 flex items-start justify-center text-sm font-bold text-color-terminal-text-muted">
                {row.rowNumber}
              </div>

              {/* Column 1: Analysis (Trend-Range) */}
              <div className="px-3 py-3 border-l border-color-terminal-border">
                <WorkflowDropdown
                  label="Trend-Range"
                  options={algorithms.trendRange}
                  selectedIds={row.analysisSelections.map((s) => s.id)}
                  onChange={(ids) =>
                    handleSelectionChange(row.id, 'analysis', ids, algorithms.trendRange)
                  }
                  theme="teal"
                  multiSelect={true}
                  showSearch={true}
                  searchPlaceholder="Search algorithms..."
                />
                <SelectionChips
                  selections={row.analysisSelections}
                  onRemove={(id) => handleRemoveChip(row.id, 'analysis', id)}
                  theme="teal"
                />
              </div>

              {/* Column 2: Strategy Steps */}
              <div className="px-3 py-3 border-l border-color-terminal-border">
                <div className="flex items-start gap-2 flex-wrap">
                  {/* Pre-condition */}
                  <WorkflowDropdown
                    label="Pre"
                    options={algorithms.preCondition}
                    selectedIds={row.preConditionSelections.map((s) => s.id)}
                    onChange={(ids) =>
                      handleSelectionChange(row.id, 'preCondition', ids, algorithms.preCondition)
                    }
                    theme="purple"
                    disabled={!conditionEnabled}
                    multiSelect={false}
                    showSearch={false}
                  />

                  {/* Select Steps */}
                  <WorkflowDropdown
                    label="Select Steps"
                    options={algorithms.selectSteps}
                    selectedIds={row.stepSelections.map((s) => s.id)}
                    onChange={(ids) =>
                      handleSelectionChange(row.id, 'steps', ids, algorithms.selectSteps)
                    }
                    theme="blue"
                    multiSelect={true}
                    showSearch={true}
                    searchPlaceholder="Search steps..."
                  />

                  {/* Post-condition */}
                  <WorkflowDropdown
                    label="Post"
                    options={algorithms.postCondition}
                    selectedIds={row.postConditionSelections.map((s) => s.id)}
                    onChange={(ids) =>
                      handleSelectionChange(row.id, 'postCondition', ids, algorithms.postCondition)
                    }
                    theme="gold"
                    disabled={!conditionEnabled}
                    multiSelect={false}
                    showSearch={false}
                  />
                </div>

                {/* Selection chips for Column 2 */}
                <div className="flex flex-wrap gap-2">
                  <SelectionChips
                    selections={row.preConditionSelections}
                    onRemove={(id) => handleRemoveChip(row.id, 'preCondition', id)}
                    theme="purple"
                  />
                  <SelectionChips
                    selections={row.stepSelections}
                    onRemove={(id) => handleRemoveChip(row.id, 'steps', id)}
                    theme="blue"
                  />
                  <SelectionChips
                    selections={row.postConditionSelections}
                    onRemove={(id) => handleRemoveChip(row.id, 'postCondition', id)}
                    theme="gold"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowRowSelector;

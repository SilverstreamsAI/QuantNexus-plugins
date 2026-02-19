/**
 * ConfigSummaryTable Component
 *
 * TICKET_378: Displays backtest configuration summary as a compact table
 * above the result charts. Shows data source, symbol, date range,
 * capital, order size, and workflow algorithms.
 */

import React from 'react';
import { cn } from '../../../lib/utils';
import type { BacktestConfigSummary, WorkflowTimeframes } from './types';
import { formatNumber } from '@shared/utils/format-locale';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ConfigSummaryTableProps {
  config: BacktestConfigSummary;
  workflowTimeframes?: WorkflowTimeframes;
  className?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatCapital = (value: number): string => {
  return `$${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatOrderSize = (size: number, unit: string): string => {
  if (unit === 'percent') return `${size}%`;
  if (unit === 'cash') return `$${size}`;
  return `${size} shares`;
};

const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-muted';
const valueClass = 'text-[11px] text-color-terminal-text tabular-nums';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ConfigSummaryTable: React.FC<ConfigSummaryTableProps> = ({
  config,
  workflowTimeframes,
  className,
}) => {
  return (
    <div className={cn(
      'border border-color-terminal-border rounded bg-color-terminal-panel/30 px-4 py-2.5',
      className,
    )}>
      <table className="w-full text-left border-collapse">
        <tbody>
          {/* Row 1: Data Source + Symbol */}
          <tr>
            <td className={cn(labelClass, 'pr-3 py-0.5 w-[100px]')}>DATA SOURCE</td>
            <td className={cn(valueClass, 'pr-6 py-0.5')}>{config.dataSource}</td>
            <td className={cn(labelClass, 'pr-3 py-0.5 w-[100px]')}>SYMBOL</td>
            <td className={cn(valueClass, 'py-0.5')}>{config.symbol}</td>
          </tr>
          {/* Row 2: Date Range */}
          <tr>
            <td className={cn(labelClass, 'pr-3 py-0.5')}>START DATE</td>
            <td className={cn(valueClass, 'pr-6 py-0.5')}>{config.startDate}</td>
            <td className={cn(labelClass, 'pr-3 py-0.5')}>END DATE</td>
            <td className={cn(valueClass, 'py-0.5')}>{config.endDate}</td>
          </tr>
          {/* Row 3: Capital + Order Size */}
          <tr>
            <td className={cn(labelClass, 'pr-3 py-0.5')}>CAPITAL</td>
            <td className={cn(valueClass, 'pr-6 py-0.5')}>{formatCapital(config.initialCapital)}</td>
            <td className={cn(labelClass, 'pr-3 py-0.5')}>ORDER SIZE</td>
            <td className={cn(valueClass, 'py-0.5')}>{formatOrderSize(config.orderSize, config.orderSizeUnit)}</td>
          </tr>
          {/* Row 4: Workflow Timeframes (if available) */}
          {workflowTimeframes && (
            <tr>
              <td className={cn(labelClass, 'pr-3 py-0.5')}>WORKFLOW</td>
              <td colSpan={3} className={cn(valueClass, 'py-0.5')}>
                <div className="flex items-center gap-3 flex-wrap">
                  {workflowTimeframes.analysis && (
                    <span>
                      <span className="text-[#64ffda]">{workflowTimeframes.analysis}</span>
                      <span className="text-color-terminal-text-muted ml-1">Analysis</span>
                    </span>
                  )}
                  {workflowTimeframes.entryFilter && (
                    <span>
                      <span className="text-[#a78bfa]">{workflowTimeframes.entryFilter}</span>
                      <span className="text-color-terminal-text-muted ml-1">Filter</span>
                    </span>
                  )}
                  {workflowTimeframes.entrySignal && (
                    <span>
                      <span className="text-[#60a5fa]">{workflowTimeframes.entrySignal}</span>
                      <span className="text-color-terminal-text-muted ml-1">Entry</span>
                    </span>
                  )}
                  {workflowTimeframes.exitStrategy && (
                    <span>
                      <span className="text-[#fbbf24]">{workflowTimeframes.exitStrategy}</span>
                      <span className="text-color-terminal-text-muted ml-1">Exit</span>
                    </span>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ConfigSummaryTable;

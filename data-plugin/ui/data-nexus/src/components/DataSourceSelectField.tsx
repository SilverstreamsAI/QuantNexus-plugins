/**
 * DataSourceSelectField Component
 *
 * PLUGIN_TICKET_018: Extracted from back-test-nexus BacktestDataConfigPanel.
 * TICKET_332: Custom dropdown with LatencyDot per option for provider connection status.
 *
 * Tier 0 shared component consumed by both back-test-nexus and quant-lab-nexus.
 */

import React, { useState, useEffect, useRef } from 'react';
import { LogIn } from 'lucide-react';
import type { DataSourceOption } from '../types/data-source';

// =============================================================================
// Utility: cn (minimal classname merger)
// =============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// =============================================================================
// TICKET_332: LatencyDot - colored indicator for provider connection status
// =============================================================================

interface LatencyDotProps {
  status: DataSourceOption['status'];
  latencyMs?: number;
}

const LatencyDot: React.FC<LatencyDotProps> = ({ status, latencyMs }) => {
  let color: string;
  let pulse = false;
  let tooltip: string;

  if (status === 'checking') {
    color = '#6b7280'; // gray
    pulse = true;
    tooltip = 'Checking...';
  } else if (status === 'disconnected' || status === 'error') {
    color = '#ef4444'; // red
    tooltip = status === 'error' ? 'Error' : 'Disconnected';
  } else if (latencyMs !== undefined) {
    if (latencyMs < 1000) {
      color = '#22c55e'; // green - healthy for remote API
    } else if (latencyMs < 3000) {
      color = '#f59e0b'; // amber - slow but connected
    } else {
      color = '#f97316'; // orange - very slow (distinct from disconnected red)
    }
    tooltip = `${latencyMs}ms`;
  } else {
    color = '#22c55e'; // green default for connected without latency
    tooltip = 'Connected';
  }

  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', pulse && 'animate-pulse')}
      style={{ backgroundColor: color }}
      title={tooltip}
    />
  );
};

// =============================================================================
// DataSourceSelectField
// =============================================================================

export interface DataSourceSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dataSources: DataSourceOption[];
  isAuthenticated: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const DataSourceSelectField: React.FC<DataSourceSelectFieldProps> = ({
  label,
  value,
  onChange,
  dataSources,
  isAuthenticated,
  error,
  disabled,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = dataSources.find(ds => ds.id === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const isOptionDisabled = (ds: DataSourceOption) =>
    ds.status === 'checking' || ds.status === 'disconnected' || ds.status === 'error' || (ds.requiresAuth && !isAuthenticated);

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-1 relative', className)}>
      <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
        {label}
      </label>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(prev => !prev)}
        disabled={disabled}
        className={cn(
          'h-9 px-3 rounded border text-sm terminal-mono text-left w-full',
          'focus:outline-none focus:ring-1 focus:ring-color-terminal-accent-primary focus:border-color-terminal-accent-primary',
          'transition-colors',
          error && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed',
          !error && 'border-color-terminal-border'
        )}
        style={{
          backgroundColor: '#112240',
          borderColor: error ? '#ef4444' : '#233554',
          color: '#e6f1ff',
        }}
      >
        <span className="flex items-center gap-2">
          <span className="truncate">{selected?.name || value}</span>
          {selected && (
            <>
              {selected.requiresAuth && !isAuthenticated && (
                <span title="Login required"><LogIn className="w-3 h-3 flex-shrink-0" style={{ color: '#f59e0b' }} /></span>
              )}
              <LatencyDot status={selected.status} latencyMs={selected.latencyMs} />
            </>
          )}
        </span>
      </button>
      {/* Dropdown */}
      {open && (
        <div
          className="absolute mt-1 z-10 rounded border shadow-lg overflow-hidden"
          style={{
            backgroundColor: '#112240',
            borderColor: '#233554',
            top: '100%',
            left: 0,
            right: 0,
          }}
        >
          {dataSources.map(ds => {
            const optDisabled = isOptionDisabled(ds);
            return (
              <button
                key={ds.id}
                type="button"
                disabled={optDisabled}
                onClick={() => {
                  if (!optDisabled) {
                    onChange(ds.id);
                    setOpen(false);
                  }
                }}
                className="w-full px-3 py-2 text-left text-sm terminal-mono flex items-center justify-between transition-colors"
                style={{
                  color: optDisabled ? '#6b7280' : '#e6f1ff',
                  backgroundColor: ds.id === value ? 'rgba(100, 255, 218, 0.15)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!optDisabled) (e.currentTarget.style.backgroundColor = 'rgba(100, 255, 218, 0.1)');
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ds.id === value ? 'rgba(100, 255, 218, 0.15)' : '';
                }}
              >
                <span>{ds.name}</span>
                <span className="flex items-center gap-1.5">
                  {ds.requiresAuth && !isAuthenticated && (
                    <span title="Login required"><LogIn className="w-3 h-3 flex-shrink-0" style={{ color: '#f59e0b' }} /></span>
                  )}
                  <LatencyDot status={ds.status} latencyMs={ds.latencyMs} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <span className="text-[10px] text-red-500 terminal-mono">{error}</span>
      )}
    </div>
  );
};

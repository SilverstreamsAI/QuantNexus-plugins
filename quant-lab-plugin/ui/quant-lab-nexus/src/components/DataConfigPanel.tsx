/**
 * DataConfigPanel Component
 *
 * PLUGIN_TICKET_015: Simplified data configuration panel for Alpha Factory backtest.
 * PLUGIN_TICKET_018: Data Source selector added from Tier 0 data-plugin.
 *
 * Layout: 4 rows
 * - Row 1: Data Source + Symbol search
 * - Row 2: Start Date + End Date
 * - Row 3: Initial Capital + Order Size + Unit
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DataConfig, OrderSizeUnit } from '../types';
import { DataSourceSelectField, DEFAULT_DATA_SOURCE } from '@plugins/data-plugin/index';
import type { DataSourceOption } from '@plugins/data-plugin/index';

/**
 * TICKET_077_D4: Inline error hint for search inputs.
 * Local copy to avoid cross-boundary import from desktop app.
 */
const SearchErrorHint: React.FC<{ error: string | null; visible: boolean }> = ({ error, visible }) => {
  if (!visible || !error) return null;
  return (
    <div
      className="absolute z-50 w-full mt-1 rounded border border-red-500/30 shadow-lg px-3 py-2.5 text-sm terminal-mono text-red-400"
      style={{ backgroundColor: '#0a192f' }}
    >
      {error}
    </div>
  );
};

// =============================================================================
// Sub-components (inline)
// =============================================================================

interface InputFieldProps {
  label: string;
  type?: 'text' | 'number' | 'date';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  step?: number;
  className?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label, type = 'text', value, onChange, placeholder, disabled, min, step, className,
}) => (
  <div className={`flex flex-col gap-1 ${className || ''}`}>
    <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      step={step}
      className="h-9 px-3 rounded border text-sm terminal-mono placeholder-[#495670] focus:outline-none focus:ring-1 focus:ring-color-terminal-accent-primary focus:border-color-terminal-accent-primary transition-colors border-color-terminal-border"
      style={{ backgroundColor: '#112240', borderColor: '#233554', color: '#e6f1ff' }}
    />
  </div>
);

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label, value, onChange, options, disabled, className,
}) => (
  <div className={`flex flex-col gap-1 ${className || ''}`}>
    <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 px-3 rounded border text-sm terminal-mono focus:outline-none focus:ring-1 focus:ring-color-terminal-accent-primary focus:border-color-terminal-accent-primary transition-colors border-color-terminal-border"
      style={{ backgroundColor: '#112240', borderColor: '#233554', color: '#e6f1ff' }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

interface SymbolSearchResult {
  symbol: string;
  name?: string;
  exchange?: string;
  startTime?: string;
  endTime?: string;
}

// =============================================================================
// DataConfigPanel
// =============================================================================

interface DataConfigPanelProps {
  value: DataConfig;
  onChange: (config: DataConfig) => void;
  disabled?: boolean;
  /** PLUGIN_TICKET_018: Available data sources from Tier 0 data-plugin */
  dataSources?: DataSourceOption[];
  /** PLUGIN_TICKET_018: Whether user is currently authenticated */
  isAuthenticated?: boolean;
}

const ORDER_UNIT_OPTIONS = [
  { value: 'percent', label: 'Percent' },
  { value: 'cash', label: 'Cash' },
  { value: 'shares', label: 'Shares' },
];

export const DataConfigPanel: React.FC<DataConfigPanelProps> = ({ value, onChange, disabled, dataSources = [], isAuthenticated = false }) => {
  const [query, setQuery] = useState(value.symbol);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setQuery(value.symbol);
  }, [value.symbol]);

  // TICKET_331: Clear cached search results when data source changes
  useEffect(() => {
    setSearchResults([]);
    setShowResults(false);
  }, [value.dataSource]);

  // TICKET_316: Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // PLUGIN_TICKET_018: Cascading reset when data source changes
  const handleDataSourceChange = useCallback((newDataSource: string) => {
    if (newDataSource === value.dataSource) return;
    onChange({
      ...value,
      dataSource: newDataSource,
      symbol: '',
      startDate: '',
      endDate: '',
    });
    setSearchResults([]);
    setSearchError(null);
    setShowResults(false);
  }, [value, onChange]);

  // TICKET_316: Debounce (300ms) + Sequence ID to fix race condition
  const handleSymbolSearch = useCallback((q: string) => {
    setQuery(q);

    // Increment to invalidate any in-flight request
    const currentId = ++requestIdRef.current;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (q.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // PLUGIN_TICKET_018: Pass current data source to symbol search
        const results = await window.electronAPI.data.searchSymbols(q, value.dataSource);
        // Discard if a newer request was issued while awaiting
        if (currentId !== requestIdRef.current) return;
        const mapped: SymbolSearchResult[] = Array.isArray(results)
          ? results.map((r: Record<string, unknown>) => ({
              symbol: (r.symbol as string) || q,
              name: (r.name as string) || undefined,
              exchange: (r.exchange as string) || undefined,
              startTime: (r.startTime as string) || undefined,
              endTime: (r.endTime as string) || undefined,
            }))
          : [];
        setSearchResults(mapped);
        setShowResults(mapped.length > 0);
        setHighlightedIndex(-1);
      } catch (err) {
        if (currentId !== requestIdRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        // TICKET_289: Show contextual error in dropdown area
        if (msg.includes('401')) {
          setSearchError('Please log in to search symbols');
          // TICKET_201: Highlight login button in BreadcrumbBar
          window.dispatchEvent(new Event('nexus:auth-required'));
        } else {
          setSearchError('Service unavailable');
        }
        setSearchResults([]);
        setShowResults(true);
      } finally {
        if (currentId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);
  }, [value.dataSource]);

  const handleSymbolSelect = useCallback(async (result: SymbolSearchResult) => {
    const updates: Partial<DataConfig> = { symbol: result.symbol };
    // Phase 1: Parse dates from search result
    if (result.startTime) {
      const d = result.startTime.split(' ')[0];
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) updates.startDate = d;
    }
    if (result.endTime) {
      const d = result.endTime.split(' ')[0];
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) updates.endDate = d;
    }
    onChange({ ...value, ...updates });
    setQuery(result.symbol);
    setShowResults(false);
    setHighlightedIndex(-1);

    // PLUGIN_TICKET_019 Phase 2: Fallback API when dates missing from search result
    if (!updates.startDate || !updates.endDate) {
      try {
        const api = (window as any).electronAPI;
        if (api?.data?.getSymbolDateRange) {
          const dateRange = await api.data.getSymbolDateRange(result.symbol, value.dataSource);
          const dateUpdates: Partial<DataConfig> = {};
          if (dateRange?.startTime && !updates.startDate) {
            const sd = dateRange.startTime.split(' ')[0];
            if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) {
              dateUpdates.startDate = sd;
            }
          }
          if (dateRange?.endTime && !updates.endDate) {
            const ed = dateRange.endTime.split(' ')[0];
            if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed)) {
              dateUpdates.endDate = ed;
            }
          }
          if (Object.keys(dateUpdates).length > 0) {
            onChange({ ...value, ...updates, ...dateUpdates });
          }
        }
      } catch (error) {
        console.warn('[DataConfigPanel] Failed to fetch symbol date range:', error);
      }
    }
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < searchResults.length - 1 ? prev + 1 : 0;
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : searchResults.length - 1;
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSymbolSelect(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setHighlightedIndex(-1);
    }
  }, [showResults, searchResults, highlightedIndex, handleSymbolSelect]);

  const update = useCallback((field: keyof DataConfig, v: string | number) => {
    onChange({ ...value, [field]: v });
  }, [value, onChange]);

  return (
    <div className="rounded-lg border border-color-terminal-border p-4 space-y-4"
         style={{ backgroundColor: 'rgba(10, 25, 47, 0.7)' }}>
      <h3 className="text-sm font-medium text-color-terminal-text-secondary terminal-mono uppercase tracking-wider">
        Data Configuration
      </h3>

      {/* Row 1: Data Source + Symbol Search */}
      <div className="grid grid-cols-2 gap-4">
        <DataSourceSelectField
          label="Data Source"
          value={value.dataSource || DEFAULT_DATA_SOURCE}
          onChange={handleDataSourceChange}
          dataSources={dataSources}
          isAuthenticated={isAuthenticated}
          disabled={disabled}
        />
      <div className="flex flex-col gap-1 relative">
        <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
          Symbol
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSymbolSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { setTimeout(() => setShowResults(false), 200); setHighlightedIndex(-1); }}
            onFocus={() => query.length >= 2 && searchResults.length > 0 && setShowResults(true)}
            placeholder="Search symbol..."
            disabled={disabled}
            className="w-full h-9 px-3 rounded border text-sm terminal-mono placeholder-[#495670] focus:outline-none focus:ring-1 focus:ring-color-terminal-accent-primary focus:border-color-terminal-accent-primary transition-colors border-color-terminal-border"
            style={{ backgroundColor: '#112240', borderColor: '#233554', color: '#e6f1ff' }}
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-color-terminal-accent-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {/* TICKET_289 + TICKET_077_D4: Search error feedback */}
          <SearchErrorHint error={searchError} visible={showResults} />
          {showResults && !searchError && searchResults.length > 0 && (
            <div ref={listRef}
                 className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded border border-color-terminal-border shadow-lg"
                 style={{ backgroundColor: '#0a192f' }}>
              {searchResults.map((r, idx) => (
                <button
                  key={r.symbol}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm terminal-mono transition-colors"
                  style={{
                    color: '#e6f1ff',
                    backgroundColor: idx === highlightedIndex ? 'rgba(100, 255, 218, 0.15)' : undefined,
                    borderLeft: idx === highlightedIndex ? '3px solid #64ffda' : '3px solid transparent',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSymbolSelect(r)}
                >
                  <span className="font-medium">{r.symbol}</span>
                  {r.name && <span className="ml-2 text-color-terminal-text-muted">{r.name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Row 2: Start Date + End Date */}
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Start Date"
          type="date"
          value={value.startDate}
          onChange={(v) => update('startDate', v)}
          disabled={disabled}
        />
        <InputField
          label="End Date"
          type="date"
          value={value.endDate}
          onChange={(v) => update('endDate', v)}
          disabled={disabled}
        />
      </div>

      {/* Row 3: Initial Capital + Order Size + Unit */}
      <div className="grid grid-cols-3 gap-4">
        <InputField
          label="Initial Capital"
          type="number"
          value={value.initialCapital}
          onChange={(v) => update('initialCapital', Number(v))}
          disabled={disabled}
          min={0}
          step={1000}
        />
        <InputField
          label="Order Size"
          type="number"
          value={value.orderSize}
          onChange={(v) => update('orderSize', Number(v))}
          disabled={disabled}
          min={0}
        />
        <SelectField
          label="Unit"
          value={value.orderSizeUnit}
          onChange={(v) => update('orderSizeUnit', v as OrderSizeUnit)}
          options={ORDER_UNIT_OPTIONS}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

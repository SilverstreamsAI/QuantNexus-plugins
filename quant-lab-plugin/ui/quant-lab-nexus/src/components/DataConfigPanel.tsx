/**
 * DataConfigPanel Component
 *
 * PLUGIN_TICKET_015: Simplified data configuration panel for Alpha Factory backtest.
 * Adapted from back-test-nexus/BacktestDataConfigPanel (590 lines -> ~200 lines).
 *
 * Layout: 3 rows
 * - Row 1: Symbol search
 * - Row 2: Start Date + End Date
 * - Row 3: Initial Capital + Order Size + Unit
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DataConfig, OrderSizeUnit } from '../types';

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
}

const ORDER_UNIT_OPTIONS = [
  { value: 'percent', label: 'Percent' },
  { value: 'cash', label: 'Cash' },
  { value: 'shares', label: 'Shares' },
];

export const DataConfigPanel: React.FC<DataConfigPanelProps> = ({ value, onChange, disabled }) => {
  const [query, setQuery] = useState(value.symbol);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setQuery(value.symbol);
  }, [value.symbol]);

  const handleSymbolSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      // data:searchSymbols returns array directly (not {success, data} wrapper)
      const results = await window.electronAPI.data.searchSymbols(q);
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
    } catch (err) {
      console.error('Symbol search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSymbolSelect = useCallback((result: SymbolSearchResult) => {
    const updates: Partial<DataConfig> = { symbol: result.symbol };
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
  }, [value, onChange]);

  const update = useCallback((field: keyof DataConfig, v: string | number) => {
    onChange({ ...value, [field]: v });
  }, [value, onChange]);

  return (
    <div className="rounded-lg border border-color-terminal-border p-4 space-y-4"
         style={{ backgroundColor: 'rgba(10, 25, 47, 0.7)' }}>
      <h3 className="text-sm font-medium text-color-terminal-text-secondary terminal-mono uppercase tracking-wider">
        Data Configuration
      </h3>

      {/* Row 1: Symbol Search */}
      <div className="flex flex-col gap-1 relative">
        <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
          Symbol
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSymbolSearch(e.target.value)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
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
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded border border-color-terminal-border shadow-lg"
                 style={{ backgroundColor: '#0a192f' }}>
              {searchResults.map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm terminal-mono hover:bg-color-terminal-accent-primary/10 transition-colors"
                  style={{ color: '#e6f1ff' }}
                  onMouseDown={(e) => e.preventDefault()}
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

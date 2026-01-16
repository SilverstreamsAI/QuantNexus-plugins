/**
 * BacktestDataConfigPanel Component (Component 8)
 *
 * Data source and configuration panel for Zone C variable content area.
 * Displays 3 rows of backtest configuration inputs:
 * - Row 1: Data Source + Symbol Search
 * - Row 2: Start Date + End Date + Timeframe
 * - Row 3: Initial Capital + Order Size + Unit
 *
 * IMPORTANT: This component does NOT include the Execute button (Zone D).
 *
 * @see TICKET_077_COMPONENT8 - BacktestDataConfigPanel Design
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface DataSourceOption {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export type TimeframeOption = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type OrderSizeUnit = 'cash' | 'percent' | 'shares';

export interface BacktestDataConfig {
  // Row 1
  symbol: string;
  dataSource: string;

  // Row 2
  startDate: string;
  endDate: string;
  timeframe: TimeframeOption;

  // Row 3
  initialCapital: number;
  orderSize: number;
  orderSizeUnit: OrderSizeUnit;
}

export interface BacktestDataConfigPanelProps {
  /** Current configuration value */
  value: BacktestDataConfig;

  /** Callback when configuration changes */
  onChange: (config: BacktestDataConfig) => void;

  /** Available data sources */
  dataSources?: DataSourceOption[];

  /** Symbol search callback */
  onSymbolSearch?: (query: string) => Promise<SymbolSearchResult[]>;

  /** Field-level validation errors */
  errors?: Partial<Record<keyof BacktestDataConfig, string>>;

  /** Disable all inputs */
  disabled?: boolean;

  /** Additional class names */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TIMEFRAME_OPTIONS: { value: TimeframeOption; label: string }[] = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
  { value: '1M', label: '1 Month' },
];

const ORDER_SIZE_UNITS: { value: OrderSizeUnit; label: string }[] = [
  { value: 'cash', label: '$' },
  { value: 'percent', label: '%' },
  { value: 'shares', label: 'Shares' },
];

const DEFAULT_DATA_SOURCE = 'clickhouse';
const DEFAULT_TIMEFRAME: TimeframeOption = '1d';
const DEFAULT_ORDER_SIZE_UNIT: OrderSizeUnit = 'percent';

// =============================================================================
// Helper Components
// =============================================================================

interface InputFieldProps {
  label: string;
  type?: 'text' | 'number' | 'date';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled,
  min,
  max,
  step,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
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
        max={max}
        step={step}
        className={cn(
          'h-9 px-3 rounded border text-sm terminal-mono placeholder-[#495670]',
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
      />
      {error && (
        <span className="text-[10px] text-red-500 terminal-mono">{error}</span>
      )}
    </div>
  );
};

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  error?: string;
  disabled?: boolean;
  className?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
  error,
  disabled,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'h-9 px-3 rounded border text-sm terminal-mono',
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
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[10px] text-red-500 terminal-mono">{error}</span>
      )}
    </div>
  );
};

interface SymbolSearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => Promise<SymbolSearchResult[]>;
  error?: string;
  disabled?: boolean;
  className?: string;
}

const SymbolSearchField: React.FC<SymbolSearchFieldProps> = ({
  label,
  value,
  onChange,
  onSearch,
  error,
  disabled,
  className,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleSearch = useCallback(
    async (q: string) => {
      setQuery(q);

      if (!onSearch || q.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await onSearch(q);
        setSearchResults(results);
        setShowResults(results.length > 0);
      } catch (err) {
        console.error('Symbol search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch]
  );

  const handleSelectResult = (result: SymbolSearchResult) => {
    onChange(result.symbol);
    setQuery(result.symbol);
    setShowResults(false);
  };

  return (
    <div className={cn('flex flex-col gap-1 relative', className)}>
      <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          onFocus={() => query.length >= 2 && searchResults.length > 0 && setShowResults(true)}
          placeholder="Search symbol..."
          disabled={disabled}
          className={cn(
            'w-full h-9 px-3 pr-8 rounded border text-sm terminal-mono placeholder-[#495670]',
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
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-color-terminal-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto z-10 rounded border shadow-lg"
          style={{
            backgroundColor: '#112240',
            borderColor: '#233554',
          }}
        >
          {searchResults.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectResult(result)}
              className="w-full px-3 py-2 text-left hover:bg-color-terminal-accent-primary/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-color-terminal-accent-primary terminal-mono">
                  {result.symbol}
                </span>
                {result.exchange && (
                  <span className="text-[10px] text-color-terminal-text-muted terminal-mono">
                    {result.exchange}
                  </span>
                )}
              </div>
              {result.name && (
                <div className="text-xs text-color-terminal-text-muted terminal-mono truncate">
                  {result.name}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <span className="text-[10px] text-red-500 terminal-mono">{error}</span>
      )}
    </div>
  );
};

interface CompoundInputProps {
  label: string;
  value: number;
  unit: OrderSizeUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: OrderSizeUnit) => void;
  units: { value: OrderSizeUnit; label: string }[];
  error?: string;
  disabled?: boolean;
  className?: string;
}

const CompoundInput: React.FC<CompoundInputProps> = ({
  label,
  value,
  unit,
  onValueChange,
  onUnitChange,
  units,
  error,
  disabled,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] uppercase tracking-wider text-color-terminal-text-muted terminal-mono">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          min={0}
          step={unit === 'percent' ? 1 : 0.01}
          className={cn(
            'flex-1 h-9 px-3 rounded border text-sm terminal-mono',
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
        />
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as OrderSizeUnit)}
          disabled={disabled}
          className={cn(
            'w-24 h-9 px-2 rounded border text-sm terminal-mono',
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
          {units.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <span className="text-[10px] text-red-500 terminal-mono">{error}</span>
      )}
    </div>
  );
};

// =============================================================================
// BacktestDataConfigPanel Component
// =============================================================================

export const BacktestDataConfigPanel: React.FC<BacktestDataConfigPanelProps> = ({
  value,
  onChange,
  dataSources = [],
  onSymbolSearch,
  errors = {},
  disabled = false,
  className,
}) => {
  // Prepare data source options
  const dataSourceOptions = dataSources.map((ds) => ({
    value: ds.id,
    label: `${ds.name} (${ds.status})`,
    disabled: ds.status !== 'connected',
  }));

  // Handlers
  const handleChange = (field: keyof BacktestDataConfig, newValue: unknown) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className={cn('backtest-data-config-panel', className)}>
      {/* Title */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        DATA CONFIGURATION
      </h2>

      <div className="space-y-4">
        {/* Row 1: Data Source + Symbol Search */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Data Source"
            value={value.dataSource || DEFAULT_DATA_SOURCE}
            onChange={(v) => handleChange('dataSource', v)}
            options={dataSourceOptions}
            error={errors.dataSource}
            disabled={disabled}
          />
          <SymbolSearchField
            label="Symbol"
            value={value.symbol}
            onChange={(v) => handleChange('symbol', v)}
            onSearch={onSymbolSearch}
            error={errors.symbol}
            disabled={disabled}
          />
        </div>

        {/* Row 2: Start Date + End Date + Timeframe */}
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Start Date"
            type="date"
            value={value.startDate}
            onChange={(v) => handleChange('startDate', v)}
            error={errors.startDate}
            disabled={disabled}
          />
          <InputField
            label="End Date"
            type="date"
            value={value.endDate}
            onChange={(v) => handleChange('endDate', v)}
            error={errors.endDate}
            disabled={disabled}
          />
          <SelectField
            label="Timeframe"
            value={value.timeframe || DEFAULT_TIMEFRAME}
            onChange={(v) => handleChange('timeframe', v as TimeframeOption)}
            options={TIMEFRAME_OPTIONS}
            error={errors.timeframe}
            disabled={disabled}
          />
        </div>

        {/* Row 3: Initial Capital + Order Size */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Initial Capital"
            type="number"
            value={value.initialCapital}
            onChange={(v) => handleChange('initialCapital', parseFloat(v) || 0)}
            placeholder="10000"
            error={errors.initialCapital}
            disabled={disabled}
            min={0}
            step={100}
          />
          <CompoundInput
            label="Order Size"
            value={value.orderSize}
            unit={value.orderSizeUnit || DEFAULT_ORDER_SIZE_UNIT}
            onValueChange={(v) => handleChange('orderSize', v)}
            onUnitChange={(u) => handleChange('orderSizeUnit', u)}
            units={ORDER_SIZE_UNITS}
            error={errors.orderSize}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default BacktestDataConfigPanel;

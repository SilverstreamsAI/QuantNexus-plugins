/**
 * BacktestDataConfigPanel Component (Component 8)
 *
 * Data source and configuration panel for Zone C variable content area.
 * Displays 3 rows of backtest configuration inputs:
 * - Row 1: Data Source + Symbol Search
 * - Row 2: Start Date + End Date
 * - Row 3: Initial Capital + Order Size + Unit
 *
 * IMPORTANT: This component does NOT include the Execute button (Zone D).
 * TICKET_248: Timeframe moved to stage-level in WorkflowRowSelector.
 *
 * @see TICKET_077_COMPONENT8 - BacktestDataConfigPanel Design
 * @see TICKET_248 - Stage-Level Timeframe Selector
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { getDateFormatHint } from '@shared/utils/format-locale';

// =============================================================================
// Types
// =============================================================================

export interface DataSourceOption {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'checking';
  requiresAuth: boolean;
  /** TICKET_305: Provider-supported intervals in UI notation */
  intervals?: string[];
  /** TICKET_305: Max lookback per interval (e.g. { '1m': '7d' }) */
  maxLookback?: Record<string, string>;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
  /** Data availability start time from backend */
  startTime?: string;
  /** Data availability end time from backend */
  endTime?: string;
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
  /** @deprecated TICKET_248: Timeframe moved to stage-level in WorkflowRowSelector */
  timeframe?: TimeframeOption;

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

  /** TICKET_293: Whether user is currently authenticated */
  isAuthenticated?: boolean;

  /** TICKET_305: Max lookback constraints per interval from current provider */
  maxLookback?: Record<string, string>;

  /** TICKET_305 Phase 3: Most restrictive lookback in days across selected timeframes */
  mostRestrictiveLookbackDays?: number;
}

// =============================================================================
// Constants
// =============================================================================

// Order unit options are generated with translations in the component
// TICKET_248: Timeframe options removed - now set at stage-level in WorkflowRowSelector

const DEFAULT_DATA_SOURCE = 'clickhouse';
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
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            style={{ color: opt.disabled ? '#6b7280' : '#e6f1ff' }}
          >
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
  /** Callback when a symbol is selected from search results */
  onSelect?: (result: SymbolSearchResult) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const SymbolSearchField: React.FC<SymbolSearchFieldProps> = ({
  label,
  value,
  onChange,
  onSearch,
  onSelect,
  error,
  disabled,
  className,
  placeholder = 'Search symbol...',
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = React.useRef<HTMLDivElement>(null);
  const requestIdRef = React.useRef(0);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // TICKET_316: Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // TICKET_316: Debounce (300ms) + Sequence ID to fix race condition
  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);

      // Increment to invalidate any in-flight request
      const currentId = ++requestIdRef.current;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!onSearch || q.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await onSearch(q);
          // Discard if a newer request was issued while awaiting
          if (currentId !== requestIdRef.current) return;
          setSearchResults(results);
          setShowResults(results.length > 0);
          setHighlightedIndex(-1);
        } catch (err) {
          if (currentId !== requestIdRef.current) return;
          console.error('Symbol search failed:', err);
          setSearchResults([]);
        } finally {
          if (currentId === requestIdRef.current) {
            setIsSearching(false);
          }
        }
      }, 300);
    },
    [onSearch]
  );

  const handleSelectResult = (result: SymbolSearchResult) => {
    onChange(result.symbol);
    setQuery(result.symbol);
    setShowResults(false);
    setHighlightedIndex(-1);
    onSelect?.(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        handleSelectResult(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setHighlightedIndex(-1);
    }
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
          onKeyDown={handleKeyDown}
          onBlur={() => { setTimeout(() => setShowResults(false), 200); setHighlightedIndex(-1); }}
          onFocus={() => query.length >= 2 && searchResults.length > 0 && setShowResults(true)}
          placeholder={placeholder}
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
          ref={listRef}
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
              onMouseEnter={() => setHighlightedIndex(idx)}
              className="w-full px-3 py-2 text-left transition-colors"
              style={{
                backgroundColor: idx === highlightedIndex ? 'rgba(100, 255, 218, 0.15)' : undefined,
                borderLeft: idx === highlightedIndex ? '3px solid #64ffda' : '3px solid transparent',
              }}
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
  isAuthenticated = false,
  maxLookback,
  mostRestrictiveLookbackDays,
}) => {
  const { t } = useTranslation('backtest');

  // TICKET_248: timeframeOptions removed - timeframe now set at stage-level in WorkflowRowSelector

  // TICKET_305 Phase 3: Real-time lookback warning
  const lookbackWarning = useMemo(() => {
    if (!mostRestrictiveLookbackDays || !value.startDate || !value.endDate) return null;
    const startMs = new Date(value.startDate).getTime();
    const endMs = new Date(value.endDate).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return null;
    const selectedDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (selectedDays <= mostRestrictiveLookbackDays) return null;
    return `Selected range (${selectedDays}d) exceeds max lookback (${mostRestrictiveLookbackDays}d)`;
  }, [mostRestrictiveLookbackDays, value.startDate, value.endDate]);

  // Generate order size unit options with translations
  const orderSizeUnits = useMemo(() => [
    { value: 'cash' as OrderSizeUnit, label: t('orderUnits.cash') },
    { value: 'percent' as OrderSizeUnit, label: t('orderUnits.percent') },
    { value: 'shares' as OrderSizeUnit, label: t('orderUnits.shares') },
  ], [t]);

  // Prepare data source options
  // TICKET_166: Show name only, use gray color for disconnected
  // TICKET_293: Disable auth-required providers when not authenticated
  const dataSourceOptions = dataSources.map((ds) => ({
    value: ds.id,
    label: ds.name,
    disabled: ds.status === 'disconnected' || ds.status === 'error' || (ds.requiresAuth && !isAuthenticated),
  }));

  // Handlers
  const handleChange = (field: keyof BacktestDataConfig, newValue: unknown) => {
    onChange({ ...value, [field]: newValue });
  };

  // TICKET_314: Cascading reset - clear dependent fields when data source changes
  const handleDataSourceChange = useCallback((newDataSource: string) => {
    if (newDataSource === value.dataSource) return;
    onChange({
      ...value,
      dataSource: newDataSource,
      symbol: '',
      startDate: '',
      endDate: '',
    });
  }, [value, onChange]);

  /**
   * Handle symbol selection from search results.
   * Auto-populate startDate and endDate from backend data availability.
   * TICKET_143: Include symbol in updates to avoid race condition with stale closure.
   * TICKET_305 Phase 2: If dates not in search result, call getSymbolDateRange API.
   */
  const handleSymbolSelect = useCallback(async (result: SymbolSearchResult) => {
    const updates: Partial<BacktestDataConfig> = {
      symbol: result.symbol,
    };

    // Parse startTime: "2005-02-13 13:00:00" -> "2005-02-13"
    if (result.startTime) {
      const startDate = result.startTime.split(' ')[0];
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        updates.startDate = startDate;
      }
    }

    // Parse endTime: "2024-10-08 13:00:00" -> "2024-10-08"
    if (result.endTime) {
      const endDate = result.endTime.split(' ')[0];
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        updates.endDate = endDate;
      }
    }

    // TICKET_305 Phase 2: Update symbol immediately (non-blocking)
    onChange({ ...value, ...updates });

    // If dates not available from search result, fetch via separate API call
    if (!updates.startDate || !updates.endDate) {
      try {
        const api = (window as any).electronAPI;
        if (api?.data?.getSymbolDateRange) {
          const dateRange = await api.data.getSymbolDateRange(result.symbol, value.dataSource);
          const dateUpdates: Partial<BacktestDataConfig> = {};

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
        // Non-fatal: user can manually set dates
        console.warn('[BacktestDataConfigPanel] Failed to fetch symbol date range:', error);
      }
    }
  }, [value, onChange]);

  return (
    <div className={cn('backtest-data-config-panel', className)}>
      {/* Title */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {t('config.title')}
      </h2>

      <div className="space-y-4">
        {/* Row 1: Data Source + Symbol Search */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label={t('config.dataSource')}
            value={value.dataSource || DEFAULT_DATA_SOURCE}
            onChange={handleDataSourceChange}
            options={dataSourceOptions}
            error={errors.dataSource}
            disabled={disabled}
          />
          <SymbolSearchField
            label={t('config.symbol')}
            value={value.symbol}
            onChange={(v) => handleChange('symbol', v)}
            onSearch={onSymbolSearch}
            onSelect={handleSymbolSelect}
            error={errors.symbol}
            disabled={disabled}
            placeholder={t('config.searchSymbol')}
          />
        </div>

        {/* Row 2: Start Date + End Date (TICKET_248: Timeframe moved to stage-level) */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label={`${t('config.startDate')} (${getDateFormatHint()})`}
            type="date"
            value={value.startDate}
            onChange={(v) => handleChange('startDate', v)}
            error={errors.startDate}
            disabled={disabled}
          />
          <InputField
            label={`${t('config.endDate')} (${getDateFormatHint()})`}
            type="date"
            value={value.endDate}
            onChange={(v) => handleChange('endDate', v)}
            error={errors.endDate}
            disabled={disabled}
          />
        </div>
        {/* TICKET_305: Max lookback hint per interval */}
        {maxLookback && Object.keys(maxLookback).length > 0 && (
          <div className="text-[10px] text-color-terminal-text/50 terminal-mono mt-1">
            {Object.entries(maxLookback).map(([tf, lb]) => `${tf}:${lb}`).join(' | ')}
          </div>
        )}
        {/* TICKET_305 Phase 3: Amber lookback warning */}
        {lookbackWarning && (
          <div className="text-[10px] text-amber-400 terminal-mono mt-1">
            {lookbackWarning}
          </div>
        )}

        {/* Row 3: Initial Capital + Order Size */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label={t('config.initialCapital')}
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
            label={t('config.orderSize')}
            value={value.orderSize}
            unit={value.orderSizeUnit || DEFAULT_ORDER_SIZE_UNIT}
            onValueChange={(v) => handleChange('orderSize', v)}
            onUnitChange={(u) => handleChange('orderSizeUnit', u)}
            units={orderSizeUnits}
            error={errors.orderSize}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default BacktestDataConfigPanel;

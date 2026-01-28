/**
 * WatchlistConfigPanel Component
 *
 * Watchlist configuration panel for Market Observer page.
 * Includes symbols input, timeframe selector, and data source selector.
 * Used in Zone C of Market Observer page (page35).
 *
 * @see TICKET_077_1 - Page Hierarchy (page35)
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WatchlistData {
  symbols: string[];
  timeframe: string;
  dataSource: string;
}

export interface TimeframeOption {
  value: string;
  label: string;
}

export interface DataSourceOption {
  value: string;
  label: string;
}

export interface WatchlistConfigPanelProps {
  /** Component title */
  title?: string;
  /** Current watchlist data */
  value: WatchlistData;
  /** Callback when watchlist data changes */
  onChange: (data: WatchlistData) => void;
  /** Timeframe options */
  timeframeOptions?: TimeframeOption[];
  /** Data source options */
  dataSourceOptions?: DataSourceOption[];
  /** Symbol input placeholder */
  symbolPlaceholder?: string;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'WATCHLIST CONFIGURATION';

const DEFAULT_TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
];

const DEFAULT_DATASOURCE_OPTIONS: DataSourceOption[] = [
  { value: 'clickhouse', label: 'CLICKHOUSE' },
  { value: 'local', label: 'LOCAL' },
];

// -----------------------------------------------------------------------------
// WatchlistConfigPanel Component
// -----------------------------------------------------------------------------

export const WatchlistConfigPanel: React.FC<WatchlistConfigPanelProps> = ({
  title = DEFAULT_TITLE,
  value,
  onChange,
  timeframeOptions = DEFAULT_TIMEFRAME_OPTIONS,
  dataSourceOptions = DEFAULT_DATASOURCE_OPTIONS,
  symbolPlaceholder = 'Enter symbol (e.g., BTCUSDT)',
  className,
}) => {
  const [symbolInput, setSymbolInput] = useState('');

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddSymbol = useCallback(() => {
    const symbol = symbolInput.trim().toUpperCase();
    if (symbol && !value.symbols.includes(symbol)) {
      onChange({
        ...value,
        symbols: [...value.symbols, symbol],
      });
      setSymbolInput('');
    }
  }, [symbolInput, value, onChange]);

  const handleRemoveSymbol = useCallback((symbol: string) => {
    onChange({
      ...value,
      symbols: value.symbols.filter(s => s !== symbol),
    });
  }, [value, onChange]);

  const handleTimeframeChange = useCallback((timeframe: string) => {
    onChange({ ...value, timeframe });
  }, [value, onChange]);

  const handleDataSourceChange = useCallback((dataSource: string) => {
    onChange({ ...value, dataSource });
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSymbol();
    }
  }, [handleAddSymbol]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('watchlist-config-panel', className)}>
      {/* Panel Container */}
      <div className="p-4 border border-color-terminal-border rounded-lg bg-color-terminal-panel/20">
        {/* Title */}
        <h3 className="text-xs font-bold uppercase tracking-wider text-color-terminal-accent-teal mb-4">
          {title}
        </h3>

        {/* Symbols Section */}
        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-2 block">
            Symbols
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={symbolPlaceholder}
              className="flex-1 px-3 py-2 text-xs terminal-mono border rounded focus:outline-none focus:border-color-terminal-accent-teal"
              style={{
                backgroundColor: '#112240',
                borderColor: '#233554',
                color: '#e6f1ff',
              }}
            />
            <button
              onClick={handleAddSymbol}
              disabled={!symbolInput.trim()}
              className={cn(
                'px-4 py-2 text-xs font-bold uppercase border rounded transition-all',
                symbolInput.trim()
                  ? 'border-color-terminal-accent-teal text-color-terminal-accent-teal hover:bg-color-terminal-accent-teal/10'
                  : 'border-color-terminal-border text-color-terminal-text-muted cursor-not-allowed'
              )}
            >
              Add
            </button>
          </div>

          {/* Symbol Tags */}
          {value.symbols.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {value.symbols.map((symbol) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase bg-color-terminal-accent-teal/20 text-color-terminal-accent-teal rounded border border-color-terminal-accent-teal/30"
                >
                  {symbol}
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="hover:text-red-400 transition-colors"
                    aria-label={`Remove ${symbol}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timeframe & Data Source Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Timeframe */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-2 block">
              Timeframe
            </label>
            <div className="flex flex-wrap gap-1.5">
              {timeframeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTimeframeChange(opt.value)}
                  className={cn(
                    'min-w-[36px] px-2.5 py-1.5 text-[10px] font-bold uppercase border rounded transition-all',
                    value.timeframe === opt.value
                      ? 'border-color-terminal-accent-gold bg-color-terminal-accent-gold/20 text-color-terminal-accent-gold'
                      : 'border-color-terminal-border text-color-terminal-text-muted hover:border-color-terminal-accent-gold/50 hover:text-color-terminal-text-secondary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Source */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary mb-2 block">
              Data Source
            </label>
            <div className="flex flex-wrap gap-1.5">
              {dataSourceOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDataSourceChange(opt.value)}
                  className={cn(
                    'px-3 py-1.5 text-[10px] font-bold uppercase border rounded transition-all',
                    value.dataSource === opt.value
                      ? 'border-color-terminal-accent-purple bg-color-terminal-accent-purple/20 text-color-terminal-accent-purple'
                      : 'border-color-terminal-border text-color-terminal-text-muted hover:border-color-terminal-accent-purple/50 hover:text-color-terminal-text-secondary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchlistConfigPanel;

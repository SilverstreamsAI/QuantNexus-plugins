/**
 * SignalSourcePicker Component
 *
 * PLUGIN_TICKET_007: Signal source selection modal.
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Portal-based modal dialog that queries signal_source_registry
 * and displays exported workflow signal sources with backtest metrics.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Database } from 'lucide-react';

export interface SignalSourceItem {
  id: string;
  name: string;
  description: string | null;
  exported_at: string;
  analysis_algorithm_name: string;
  entry_algorithm_name: string;
  exit_algorithm_name: string | null;
  analysis_timeframe: string;
  entry_timeframe: string;
  exit_timeframe: string | null;
  backtest_sharpe: number | null;
  backtest_max_drawdown: number | null;
  backtest_win_rate: number | null;
  backtest_total_trades: number | null;
  backtest_profit_factor: number | null;
  symbol: string | null;
}

interface SignalSourcePickerProps {
  visible: boolean;
  onSelect: (source: SignalSourceItem) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export const SignalSourcePicker: React.FC<SignalSourcePickerProps> = ({
  visible,
  onSelect,
  onClose,
  excludeIds = [],
}) => {
  const [sources, setSources] = useState<SignalSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch signal sources when modal opens
  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    setError(null);
    setSearchQuery('');

    window.electronAPI.signalSource
      .list()
      .then((result) => {
        if (result.success && result.data) {
          setSources(result.data);
        } else {
          setError(result.error || 'Failed to load signal sources');
        }
      })
      .catch((err) => {
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [visible]);

  // Escape key to close
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Backdrop click to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Filter: exclude already-added + search
  const filteredSources = useMemo(() => {
    const excludeSet = new Set(excludeIds);
    return sources
      .filter((s) => !excludeSet.has(s.id))
      .filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.analysis_algorithm_name?.toLowerCase().includes(q) ||
          s.entry_algorithm_name?.toLowerCase().includes(q)
        );
      });
  }, [sources, excludeIds, searchQuery]);

  if (!visible) return null;

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const formatNumber = (val: number | null, decimals = 2): string => {
    if (val == null) return '--';
    return val.toFixed(decimals);
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-lg mx-4 rounded-xl border border-color-terminal-accent-primary/30 bg-color-terminal-surface shadow-2xl shadow-color-terminal-accent-primary/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-color-terminal-border">
          <h3 className="text-sm font-semibold text-color-terminal-accent-primary uppercase tracking-wide">
            Select Signal Source
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-color-terminal-surface/80 transition-colors"
          >
            <X className="w-4 h-4 text-color-terminal-text-secondary" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-color-terminal-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-color-terminal-text-secondary" />
            <input
              type="text"
              placeholder="Search signals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            />
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="px-5 py-10 text-center text-sm text-color-terminal-text-secondary">
              Loading signal sources...
            </div>
          )}

          {error && (
            <div className="px-5 py-10 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && filteredSources.length === 0 && (
            <div className="px-5 py-10 text-center">
              <Database className="w-8 h-8 mx-auto mb-2 text-color-terminal-text-secondary/50" />
              <p className="text-sm text-color-terminal-text-secondary">
                {sources.length === 0
                  ? 'No exported signals yet. Export a backtest result from Strategy Builder first.'
                  : 'No matching signals found.'}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredSources.map((source) => (
              <div
                key={source.id}
                className="px-5 py-3 border-b border-color-terminal-border/50 hover:bg-color-terminal-accent-primary/5 transition-colors cursor-pointer"
                onDoubleClick={() => onSelect(source)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-color-terminal-text-primary truncate">
                      {source.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-color-terminal-text-secondary">
                      <span>Sharpe: {formatNumber(source.backtest_sharpe)}</span>
                      <span>WR: {formatNumber(source.backtest_win_rate, 1)}%</span>
                      <span>Trades: {source.backtest_total_trades ?? '--'}</span>
                      <span>PF: {formatNumber(source.backtest_profit_factor)}</span>
                    </div>
                    <div className="mt-1 text-xs text-color-terminal-text-secondary/70">
                      {source.symbol && <span>{source.symbol} | </span>}
                      Exported: {formatDate(source.exported_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelect(source)}
                    className="ml-3 flex-shrink-0 h-8 px-3 rounded-lg border border-color-terminal-accent-primary/50 hover:border-color-terminal-accent-primary hover:bg-color-terminal-accent-primary/10 text-color-terminal-accent-primary text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

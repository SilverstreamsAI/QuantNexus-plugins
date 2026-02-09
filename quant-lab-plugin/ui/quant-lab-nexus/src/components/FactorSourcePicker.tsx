/**
 * FactorSourcePicker Component
 *
 * TICKET_276: Factor source selection modal.
 * Portal-based modal dialog that fetches factors from backend
 * (desktop-api.silvonastream.com) and displays them with IC/ICIR/Sharpe metrics.
 * Mirrors SignalSourcePicker pattern.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, BarChart3 } from 'lucide-react';
import { FactorChip } from '../types';
import { FACTOR_CATEGORIES } from '../constants';

interface BackendFactorItem {
  id: string;
  name: string;
  category: string;
  source: string;
  factor_type: string; // TICKET_281: 'time_series' | 'cross_sectional'
  formula: string | null;
  ic: number | null;
  icir: number | null;
  sharpe: number | null;
}

interface FactorSourcePickerProps {
  visible: boolean;
  onSelect: (factor: FactorChip) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export const FactorSourcePicker: React.FC<FactorSourcePickerProps> = ({
  visible,
  onSelect,
  onClose,
  excludeIds = [],
}) => {
  const [factors, setFactors] = useState<BackendFactorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch factors when modal opens
  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    setError(null);
    setSearchQuery('');
    setCategoryFilter('all');

    window.electronAPI.factor.local
      .list({ factor_type: 'time_series' })
      .then((result) => {
        if (result.success && result.data) {
          setFactors(result.data);
        } else {
          setError(result.error || 'Failed to load factors');
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

  // Build FactorChip from backend item
  const handleSelect = useCallback(
    (item: BackendFactorItem) => {
      const chip: FactorChip = {
        id: item.id,
        name: item.name,
        category: item.category,
        source: item.source,
        factor_type: (item.factor_type as 'time_series' | 'cross_sectional') || 'time_series',
        formula: item.formula,
        ic: item.ic,
        icir: item.icir,
        sharpe: item.sharpe,
      };
      onSelect(chip);
    },
    [onSelect],
  );

  // Filter: exclude already-added + search + category
  const filteredFactors = useMemo(() => {
    const excludeSet = new Set(excludeIds);
    return factors
      .filter((f) => !excludeSet.has(f.id))
      .filter((f) => {
        if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
        );
      });
  }, [factors, excludeIds, searchQuery, categoryFilter]);

  if (!visible) return null;

  const formatNumber = (val: number | null, decimals = 3): string => {
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
            Select Factor
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-color-terminal-surface/80 transition-colors"
          >
            <X className="w-4 h-4 text-color-terminal-text-secondary" />
          </button>
        </div>

        {/* Search + Category Filter */}
        <div className="px-5 py-3 border-b border-color-terminal-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-color-terminal-text-secondary" />
            <input
              type="text"
              placeholder="Search factors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-color-terminal-accent-primary text-color-terminal-bg'
                  : 'bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-secondary hover:text-color-terminal-text-primary'
              }`}
            >
              All
            </button>
            {FACTOR_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  categoryFilter === cat.value
                    ? 'bg-color-terminal-accent-primary text-color-terminal-bg'
                    : 'bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-secondary hover:text-color-terminal-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="px-5 py-10 text-center text-sm text-color-terminal-text-secondary">
              Loading factors...
            </div>
          )}

          {error && (
            <div className="px-5 py-10 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && filteredFactors.length === 0 && (
            <div className="px-5 py-10 text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-color-terminal-text-secondary/50" />
              <p className="text-sm text-color-terminal-text-secondary">
                {factors.length === 0
                  ? 'No factors available. Check backend connection.'
                  : 'No matching factors found.'}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredFactors.map((factor) => (
              <div
                key={factor.id}
                className="px-5 py-3 border-b border-color-terminal-border/50 hover:bg-color-terminal-accent-primary/5 transition-colors cursor-pointer"
                onDoubleClick={() => handleSelect(factor)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-color-terminal-text-primary truncate">
                      {factor.name}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-color-terminal-text-secondary">
                      <span className="px-1.5 py-0.5 rounded bg-color-terminal-accent-primary/10 text-color-terminal-accent-primary">
                        {factor.category}
                      </span>
                      <span>IC: {formatNumber(factor.ic)}</span>
                      <span>ICIR: {formatNumber(factor.icir)}</span>
                      <span>Sharpe: {formatNumber(factor.sharpe, 2)}</span>
                    </div>
                    <div className="mt-1 text-xs text-color-terminal-text-secondary/70">
                      Source: {factor.source}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelect(factor)}
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

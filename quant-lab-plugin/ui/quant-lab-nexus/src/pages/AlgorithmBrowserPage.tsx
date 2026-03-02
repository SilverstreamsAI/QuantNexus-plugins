/**
 * AlgorithmBrowserPage Component
 *
 * TICKET_426_1: Browse, search, filter, and export algorithms from nona_algorithms.
 * Follows section styling from PersonaSection, modal pattern from SignalSourcePicker.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, Database, ChevronDown, ChevronRight, X, Download } from 'lucide-react';
import { formatDate as sharedFormatDate } from '@shared/utils/format-locale';
import { useAlgorithmList } from '../hooks/useAlgorithmList';
import { AlgorithmBrowserItem } from '../types';
import { STRATEGY_TYPE_LABELS, TIMEFRAME_OPTIONS } from '../constants';

// =============================================================================
// Export Dialog
// =============================================================================

interface ExportDialogProps {
  visible: boolean;
  selectedAlgorithms: AlgorithmBrowserItem[];
  onClose: () => void;
  onExported: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ visible, selectedAlgorithms, onClose, onExported }) => {
  const { t } = useTranslation('quant-lab');
  const [name, setName] = useState('');
  const [analysisId, setAnalysisId] = useState<number | ''>('');
  const [entryId, setEntryId] = useState<number | ''>('');
  const [exitId, setExitId] = useState<number | ''>('');
  const [timeframe, setTimeframe] = useState('1h');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysisAlgos = useMemo(
    () => selectedAlgorithms.filter(a => a.strategy_type === 9),
    [selectedAlgorithms],
  );
  const entryAlgos = useMemo(
    () => selectedAlgorithms.filter(a => a.strategy_type === 1 || a.strategy_type === 3),
    [selectedAlgorithms],
  );
  const exitAlgos = useMemo(
    () => selectedAlgorithms.filter(a => a.strategy_type === 6),
    [selectedAlgorithms],
  );

  const canExport = name.trim() && analysisId !== '' && entryId !== '';

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    setExporting(true);
    setError(null);

    try {
      const result = await window.electronAPI.algorithm.exportAsSignalSource({
        name: name.trim(),
        analysisId: analysisId as number,
        entryId: entryId as number,
        exitId: exitId !== '' ? (exitId as number) : undefined,
        timeframe,
      });

      if (result.success) {
        onExported();
        onClose();
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [canExport, name, analysisId, entryId, exitId, timeframe, onExported, onClose]);

  if (!visible) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="w-[500px] max-h-[80vh] rounded-lg border border-color-terminal-border bg-color-terminal-surface shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-color-terminal-border">
          <h3 className="text-sm font-semibold text-color-terminal-text-primary">
            {t('algorithmBrowser.exportTitle')}
          </h3>
          <button onClick={onClose} className="text-color-terminal-text-secondary hover:text-color-terminal-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-auto flex-1">
          {/* Name */}
          <div>
            <label className="block text-xs text-color-terminal-text-secondary mb-1">
              {t('algorithmBrowser.exportName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
              placeholder={t('algorithmBrowser.exportNamePlaceholder')}
            />
          </div>

          {/* Analysis selector */}
          <div>
            <label className="block text-xs text-color-terminal-text-secondary mb-1">
              {t('algorithmBrowser.roleAnalysis')} (strategy_type=9)
            </label>
            <select
              value={analysisId}
              onChange={(e) => setAnalysisId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            >
              <option value="">{t('algorithmBrowser.selectAlgorithm')}</option>
              {analysisAlgos.map(a => (
                <option key={a.id} value={a.id}>{a.strategy_name}</option>
              ))}
            </select>
          </div>

          {/* Entry selector */}
          <div>
            <label className="block text-xs text-color-terminal-text-secondary mb-1">
              {t('algorithmBrowser.roleEntry')} (strategy_type=1/3)
            </label>
            <select
              value={entryId}
              onChange={(e) => setEntryId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            >
              <option value="">{t('algorithmBrowser.selectAlgorithm')}</option>
              {entryAlgos.map(a => (
                <option key={a.id} value={a.id}>{a.strategy_name}</option>
              ))}
            </select>
          </div>

          {/* Exit selector (optional) */}
          <div>
            <label className="block text-xs text-color-terminal-text-secondary mb-1">
              {t('algorithmBrowser.roleExit')} (strategy_type=6, {t('algorithmBrowser.optional')})
            </label>
            <select
              value={exitId}
              onChange={(e) => setExitId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            >
              <option value="">{t('algorithmBrowser.noExit')}</option>
              {exitAlgos.map(a => (
                <option key={a.id} value={a.id}>{a.strategy_name}</option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-xs text-color-terminal-text-secondary mb-1">
              {t('algorithmBrowser.timeframe')}
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            >
              {TIMEFRAME_OPTIONS.map(tf => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-color-terminal-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-color-terminal-border text-color-terminal-text-secondary hover:text-color-terminal-text-primary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport || exporting}
            className="px-3 py-1.5 text-sm rounded bg-color-terminal-accent-primary text-white disabled:opacity-50 hover:opacity-90"
          >
            {exporting ? '...' : t('algorithmBrowser.exportButton')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

// =============================================================================
// Main Page
// =============================================================================

export const AlgorithmBrowserPage: React.FC = () => {
  const { t } = useTranslation('quant-lab');
  const { algorithms, isLoading, error, refresh } = useAlgorithmList();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | ''>('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportDialogVisible, setExportDialogVisible] = useState(false);

  // Filter algorithms
  const filteredAlgorithms = useMemo(() => {
    return algorithms.filter(a => {
      if (typeFilter !== '' && a.strategy_type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = a.strategy_name?.toLowerCase().includes(q);
        const codeMatch = a.code?.toLowerCase().includes(q);
        let metaMatch = false;
        if (a.classification_metadata) {
          try {
            const meta = JSON.parse(a.classification_metadata);
            metaMatch = (meta.signal_source || '').toLowerCase().includes(q) ||
                        (meta.regime_type || '').toLowerCase().includes(q);
          } catch { /* ignore */ }
        }
        return nameMatch || codeMatch || metaMatch;
      }
      return true;
    });
  }, [algorithms, searchQuery, typeFilter]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedAlgorithms = useMemo(
    () => algorithms.filter(a => selectedIds.has(a.id)),
    [algorithms, selectedIds],
  );

  const handleExported = useCallback(() => {
    setSelectedIds(new Set());
    refresh();
  }, [refresh]);

  const formatDate = (iso: string): string => {
    try {
      return sharedFormatDate(iso);
    } catch {
      return iso;
    }
  };

  const parseMetaField = (meta: string | null, field: string): string => {
    if (!meta) return '--';
    try {
      const parsed = JSON.parse(meta);
      return parsed[field] || '--';
    } catch {
      return '--';
    }
  };

  // Unique strategy_type values for filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set(algorithms.map(a => a.strategy_type));
    return Array.from(types).sort((a, b) => a - b);
  }, [algorithms]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
          <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-color-terminal-accent-primary" />
            {t('algorithmBrowser.title')}
          </h2>

          {/* Search + Filter Row */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-color-terminal-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('algorithmBrowser.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
            >
              <option value="">{t('algorithmBrowser.allTypes')}</option>
              {availableTypes.map(type => (
                <option key={type} value={type}>
                  {STRATEGY_TYPE_LABELS[type] || `Type ${type}`}
                </option>
              ))}
            </select>
          </div>

          {/* Export Action */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded border border-color-terminal-accent-primary/30 bg-color-terminal-accent-primary/5">
              <span className="text-sm text-color-terminal-text-secondary">
                {t('algorithmBrowser.selected', { count: selectedIds.size })}
              </span>
              <button
                onClick={() => setExportDialogVisible(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-color-terminal-accent-primary text-white hover:opacity-90"
              >
                <Download className="w-3.5 h-3.5" />
                {t('algorithmBrowser.exportButton')}
              </button>
            </div>
          )}

          {/* Loading / Error */}
          {isLoading && (
            <p className="text-sm text-color-terminal-text-secondary">{t('algorithmBrowser.loading')}</p>
          )}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Algorithm List */}
          {!isLoading && filteredAlgorithms.length === 0 && (
            <div className="text-center py-12">
              <Database className="w-10 h-10 mx-auto text-color-terminal-text-secondary/40 mb-3" />
              <p className="text-sm text-color-terminal-text-secondary">
                {t('algorithmBrowser.empty')}
              </p>
            </div>
          )}

          {!isLoading && filteredAlgorithms.length > 0 && (
            <div className="space-y-1">
              {/* Table header */}
              <div className="grid grid-cols-[32px_1fr_120px_120px_120px_140px] gap-2 px-3 py-2 text-xs font-medium text-color-terminal-text-secondary uppercase">
                <span />
                <span>{t('algorithmBrowser.colName')}</span>
                <span>{t('algorithmBrowser.colType')}</span>
                <span>{t('algorithmBrowser.colSignalSource')}</span>
                <span>{t('algorithmBrowser.colRegime')}</span>
                <span>{t('algorithmBrowser.colDate')}</span>
              </div>

              {filteredAlgorithms.map(algo => (
                <div key={algo.id} className="border border-color-terminal-border/50 rounded">
                  {/* Row */}
                  <div className="grid grid-cols-[32px_1fr_120px_120px_120px_140px] gap-2 px-3 py-2 items-center hover:bg-color-terminal-surface/50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(algo.id)}
                      onChange={() => toggleSelect(algo.id)}
                      className="w-4 h-4"
                    />
                    <button
                      onClick={() => toggleExpand(algo.id)}
                      className="flex items-center gap-2 text-sm text-color-terminal-text-primary text-left"
                    >
                      {expandedIds.has(algo.id)
                        ? <ChevronDown className="w-3.5 h-3.5 text-color-terminal-text-secondary flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-color-terminal-text-secondary flex-shrink-0" />
                      }
                      <span className="truncate">{algo.strategy_name}</span>
                    </button>
                    <span className="text-xs px-2 py-0.5 rounded bg-color-terminal-accent-primary/10 text-color-terminal-accent-primary text-center">
                      {STRATEGY_TYPE_LABELS[algo.strategy_type] || `Type ${algo.strategy_type}`}
                    </span>
                    <span className="text-xs text-color-terminal-text-secondary truncate">
                      {parseMetaField(algo.classification_metadata, 'signal_source')}
                    </span>
                    <span className="text-xs text-color-terminal-text-secondary truncate">
                      {parseMetaField(algo.classification_metadata, 'regime_type')}
                    </span>
                    <span className="text-xs text-color-terminal-text-secondary tabular-nums">
                      {formatDate(algo.create_time)}
                    </span>
                  </div>

                  {/* Expanded code preview */}
                  {expandedIds.has(algo.id) && (
                    <div className="border-t border-color-terminal-border/50 p-3">
                      <pre className="text-xs text-color-terminal-text-primary bg-color-terminal-surface rounded p-3 overflow-auto max-h-[300px] whitespace-pre font-mono">
                        {algo.code}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Export Dialog */}
        <ExportDialog
          visible={exportDialogVisible}
          selectedAlgorithms={selectedAlgorithms}
          onClose={() => setExportDialogVisible(false)}
          onExported={handleExported}
        />
      </div>
    </div>
  );
};

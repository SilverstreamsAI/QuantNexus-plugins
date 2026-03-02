/**
 * BatchGenerationSection Component
 *
 * TICKET_426_1: Batch strategy generation config panel for Alpha Factory.
 * TICKET_426_2: LLM provider/model inline dropdowns, Generate button validation,
 *               preference ownership moved to PersonaSection (no duplication).
 * TICKET_427: LLM provider/model selection with localStorage persistence (TICKET_419).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, XCircle } from 'lucide-react';
import { useBatchGenerationStore } from '../stores/useBatchGenerationStore';
import { REGIME_TYPE_OPTIONS, INDICATOR_POOL_OPTIONS, LLM_PROVIDER_OPTIONS } from '../constants';

const QUANTITY_MIN = 1;
const QUANTITY_MAX = 50;

export const BatchGenerationSection: React.FC = () => {
  const { t } = useTranslation('quant-lab');
  const {
    regime, setRegime,
    indicators, setIndicators,
    quantity, setQuantity,
    persona, preference,
    llmProvider, setLlmProvider,
    llmModel, setLlmModel,
    status, setStatus,
    progress, setProgress,
    error, setError,
  } = useBatchGenerationStore();

  const isGenerating = status === 'generating';

  // TICKET_429: Auth state via IPC (plugin cannot import host hooks)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.auth) return;

    api.auth.getState().then((result) => {
      if (result.success && result.data) {
        setIsAuthenticated(result.data.isAuthenticated);
      }
    });

    const unsubAuth = api.auth.onStateChanged((data) => {
      setIsAuthenticated(data.isAuthenticated);
    });

    return () => unsubAuth();
  }, []);

  // TICKET_426_2: Derive models list from selected provider
  const currentProvider = useMemo(
    () => LLM_PROVIDER_OPTIONS.find(p => p.id === llmProvider),
    [llmProvider],
  );
  const availableModels = currentProvider?.models ?? [];

  // TICKET_426_2 + TICKET_429: Validate Generate button preconditions (includes auth)
  const canGenerate = indicators.length > 0 && !!llmProvider && !!llmModel && isAuthenticated;

  const toggleIndicator = (value: string) => {
    if (indicators.includes(value)) {
      setIndicators(indicators.filter((ind: string) => ind !== value));
    } else {
      setIndicators([...indicators, value]);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setLlmProvider(providerId);
    // Reset model to first available when provider changes
    const provider = LLM_PROVIDER_OPTIONS.find(p => p.id === providerId);
    if (provider && provider.models.length > 0) {
      setLlmModel(provider.models[0].id);
    }
  };

  const handleGenerate = async () => {
    // TICKET_429: Pre-flight auth gate
    if (!isAuthenticated) {
      window.dispatchEvent(new Event('nexus:auth-required'));
      return;
    }
    if (indicators.length === 0) {
      setError(t('batchGeneration.errorNoIndicators'));
      return;
    }
    if (!llmProvider || !llmModel) {
      setError(t('batchGeneration.errorNoModel', 'LLM model selection is required'));
      return;
    }

    setError(null);
    setStatus('generating');
    setProgress({ completed: 0, total: quantity, currentName: '' });

    const result = await window.electronAPI.batchGeneration.start({
      regime,
      indicators,
      quantity,
      preference: preference || undefined,
      persona: persona || undefined,
      llmProvider,
      llmModel,
    });

    if (!result.success) {
      setError(result.error || 'Failed to start batch generation');
      setStatus('error');
    }
  };

  const handleCancel = async () => {
    await window.electronAPI.batchGeneration.cancel();
  };

  // Subscribe to IPC events
  useEffect(() => {
    const unsubProgress = window.electronAPI.batchGeneration.onProgress((data) => {
      setProgress({
        completed: data.completed,
        total: data.total,
        currentName: data.currentName,
      });
    });

    const unsubComplete = window.electronAPI.batchGeneration.onComplete((data) => {
      setStatus('completed');
      setProgress({ completed: data.succeeded, total: data.total, currentName: '' });
      if (data.failed > 0) {
        setError(`${data.succeeded}/${data.total} succeeded, ${data.failed} failed`);
      }
    });

    const unsubError = window.electronAPI.batchGeneration.onError((data) => {
      setStatus('error');
      setError(data.message);
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubError();
    };
  }, [setProgress, setStatus, setError]);

  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <Layers className="w-5 h-5 text-color-terminal-accent-primary" />
        {t('batchGeneration.title')}
      </h2>

      {/* LLM Provider */}
      <div className="mb-4">
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('batchGeneration.llmProviderLabel', 'LLM Provider')}
        </label>
        <select
          value={llmProvider}
          onChange={(e) => handleProviderChange(e.target.value)}
          disabled={isGenerating}
          className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary disabled:opacity-50"
        >
          {LLM_PROVIDER_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.name}</option>
          ))}
        </select>
      </div>

      {/* LLM Model */}
      <div className="mb-4">
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('batchGeneration.llmModelLabel', 'Model')}
        </label>
        <select
          value={llmModel}
          onChange={(e) => setLlmModel(e.target.value)}
          disabled={isGenerating}
          className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary disabled:opacity-50"
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}{m.description ? ` - ${m.description}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Regime */}
      <div className="mb-4">
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('batchGeneration.regimeLabel')}
        </label>
        <select
          value={regime}
          onChange={(e) => setRegime(e.target.value)}
          disabled={isGenerating}
          className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary disabled:opacity-50"
        >
          {REGIME_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Indicators (multi-select chips) */}
      <div className="mb-4">
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('batchGeneration.indicatorsLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          {INDICATOR_POOL_OPTIONS.map(opt => {
            const isSelected = indicators.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleIndicator(opt.value)}
                disabled={isGenerating}
                className={`px-3 py-1 text-xs rounded border transition-colors disabled:opacity-50 ${
                  isSelected
                    ? 'border-color-terminal-accent-primary bg-color-terminal-accent-primary/15 text-color-terminal-accent-primary'
                    : 'border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-primary/50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quantity */}
      <div className="mb-4">
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('batchGeneration.quantityLabel')}
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => {
            const v = Math.max(QUANTITY_MIN, Math.min(QUANTITY_MAX, Number(e.target.value) || QUANTITY_MIN));
            setQuantity(v);
          }}
          min={QUANTITY_MIN}
          max={QUANTITY_MAX}
          disabled={isGenerating}
          className="w-24 px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary disabled:opacity-50"
        />
      </div>

      {/* Progress bar */}
      {isGenerating && progress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-color-terminal-text-secondary mb-1">
            <span>{progress.currentName || t('batchGeneration.generating')}</span>
            <span>{progress.completed}/{progress.total}</span>
          </div>
          <div className="w-full h-2 rounded bg-color-terminal-border overflow-hidden">
            <div
              className="h-full bg-color-terminal-accent-primary transition-all"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 text-xs text-red-400">{error}</p>
      )}

      {/* Generate / Cancel buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="px-4 py-2 text-sm rounded bg-color-terminal-accent-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {isGenerating ? t('batchGeneration.generating') : t('batchGeneration.generateButton')}
        </button>

        {isGenerating && (
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm rounded border border-red-400/50 text-red-400 hover:bg-red-400/10 flex items-center gap-1"
          >
            <XCircle className="w-4 h-4" />
            {t('batchGeneration.cancelButton', 'Cancel')}
          </button>
        )}
      </div>
    </section>
  );
};

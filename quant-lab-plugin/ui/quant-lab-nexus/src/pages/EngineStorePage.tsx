/**
 * EngineStorePage Component
 *
 * TICKET_287: Factor Engine Desktop Installation Architecture
 * Displays available factor engines with install/uninstall controls.
 * Engine registry sourced from factor_engine_registry table via IPC.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, Download, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { FactorEngineInfo } from '../types';

export const EngineStorePage: React.FC = () => {
  const [engines, setEngines] = useState<FactorEngineInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionEngineId, setActionEngineId] = useState<string | null>(null);

  const fetchEngines = useCallback(async () => {
    try {
      const res = await window.electronAPI.factorEngine.registry();
      if (res.success && res.data) {
        setEngines(
          res.data.map(row => ({
            engineId: row.engine_id,
            displayName: row.display_name,
            description: row.description,
            pythonPackage: row.python_package,
            factorCount: row.factor_count,
            examples: row.examples,
            builtin: row.builtin === 1,
            installed: row.installed === 1,
            version: row.version,
            installedAt: row.installed_at,
          }))
        );
      }
    } catch (err) {
      console.error('[EngineStore] Failed to fetch registry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEngines();
  }, [fetchEngines]);

  const handleInstall = useCallback(async (engineId: string) => {
    setActionEngineId(engineId);
    try {
      const res = await window.electronAPI.factorEngine.install(engineId);
      if (!res.success) {
        console.error('[EngineStore] Install failed:', res.error);
      }
      await fetchEngines();
    } catch (err) {
      console.error('[EngineStore] Install error:', err);
    } finally {
      setActionEngineId(null);
    }
  }, [fetchEngines]);

  const handleUninstall = useCallback(async (engineId: string) => {
    setActionEngineId(engineId);
    try {
      const res = await window.electronAPI.factorEngine.uninstall(engineId);
      if (!res.success) {
        console.error('[EngineStore] Uninstall failed:', res.error);
      }
      await fetchEngines();
    } catch (err) {
      console.error('[EngineStore] Uninstall error:', err);
    } finally {
      setActionEngineId(null);
    }
  }, [fetchEngines]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-color-terminal-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-color-terminal-accent-primary/20 to-color-terminal-accent-teal/20 flex items-center justify-center border border-color-terminal-accent-primary/30">
            <Cpu className="w-8 h-8 text-color-terminal-accent-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-color-terminal-text-primary">
              FACTOR ENGINE STORE
            </h1>
            <p className="text-color-terminal-text-secondary">
              Install and manage factor evaluation engines
            </p>
          </div>
        </div>

        {/* Engine Cards */}
        <div className="flex flex-col gap-4">
          {engines.map(engine => {
            const isActioning = actionEngineId === engine.engineId;
            const exampleList = engine.examples
              ? engine.examples.split(',').map(s => s.trim())
              : [];

            return (
              <div
                key={engine.engineId}
                className="p-5 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30 hover:border-color-terminal-accent-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-color-terminal-text-primary">
                        {engine.displayName}
                      </h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-color-terminal-accent-primary/10 text-color-terminal-accent-primary">
                        {engine.factorCount} factors
                      </span>
                      {engine.builtin && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/15 text-blue-400">
                          Built-in
                        </span>
                      )}
                      {engine.installed && !engine.builtin && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/15 text-emerald-400">
                          Installed
                        </span>
                      )}
                    </div>

                    {engine.description && (
                      <p className="text-sm text-color-terminal-text-secondary mb-2">
                        {engine.description}
                      </p>
                    )}

                    {exampleList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {exampleList.map(ex => (
                          <span
                            key={ex}
                            className="px-2 py-0.5 text-xs rounded bg-color-terminal-surface border border-color-terminal-border/50 text-color-terminal-text-secondary"
                          >
                            {ex}
                          </span>
                        ))}
                      </div>
                    )}

                    {engine.installed && engine.version && (
                      <p className="text-xs text-color-terminal-text-secondary mt-2">
                        v{engine.version}
                        {engine.installedAt && ` · installed ${engine.installedAt.split('T')[0]}`}
                      </p>
                    )}
                  </div>

                  {/* Right: Action */}
                  <div className="flex-shrink-0">
                    {engine.builtin ? (
                      <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>Built-in</span>
                      </div>
                    ) : engine.installed ? (
                      <button
                        onClick={() => handleUninstall(engine.engineId)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {isActioning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        <span>Uninstall</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstall(engine.engineId)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-color-terminal-accent-primary/30 text-color-terminal-accent-primary hover:bg-color-terminal-accent-primary/10 transition-colors disabled:opacity-50"
                      >
                        {isActioning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>Install</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * AlphaFactoryPage Component (Composition Layer)
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_004: Combinator Page UI
 * PLUGIN_TICKET_007: Signal source selection from registry
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * PLUGIN_TICKET_010: Populate component details, timeframe change handler
 * PLUGIN_TICKET_011: Config persistence delegated to useAlphaFactoryConfig hook
 * PLUGIN_TICKET_012: Config sidebar for multi-config management
 * PLUGIN_TICKET_015: Data config + backtest execution integration
 * TICKET_275: Exit Factory rewritten to built-in risk override panel (no exit picker)
 *
 * PLUGIN_TICKET_016: Replace BacktestResultPanel with full ResultSection
 *
 * Layout: ConfigSidebar (left) + Content Area (right).
 * Composes SignalFactorySection + FlowDivider + ExitFactorySection + DataConfigPanel + ActionBar + ResultSection.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { DataSourceOption } from '@plugins/data-plugin/index';
import { SignalChip, FactorChip, DataConfig } from '../types';
import { DEFAULT_DATA_CONFIG } from '../constants';
import { SignalFactorySection } from '../components/SignalFactorySection';
import { FactorFactorySection } from '../components/FactorFactorySection';
import { ExitFactorySection } from '../components/ExitFactorySection';
import { FlowDivider } from '../components/FlowDivider';
import { ActionBar } from '../components/ActionBar';
import { DataConfigPanel } from '../components/DataConfigPanel';
import { ResultSection } from '../components/ResultSection';
import { SignalSourcePicker, SignalSourceItem } from '../components/SignalSourcePicker';
import { FactorSourcePicker } from '../components/FactorSourcePicker';
import { ConfigSidebar } from '../components/ConfigSidebar';
import { useAlphaFactoryConfig } from '../hooks/useAlphaFactoryConfig';
import { useAlphaFactoryBacktest } from '../hooks/useAlphaFactoryBacktest';

export const AlphaFactoryPage: React.FC = () => {
  const {
    signals, setSignals,
    signalMethod, setSignalMethod,
    lookback, setLookback,
    exitRules, setExitRules,
    exitMethod, setExitMethod,
    // TICKET_276: Factor layer
    factors, setFactors,
    factorMethod, setFactorMethod,
    factorLookback, setFactorLookback,
    saveAs,
    // PLUGIN_TICKET_012: Sidebar props
    configId,
    configList,
    isLoadingList,
    switchConfig,
    createNewConfig,
    deleteConfig,
  } = useAlphaFactoryConfig();

  // PLUGIN_TICKET_015: Data config state
  const [dataConfig, setDataConfig] = useState<DataConfig>(DEFAULT_DATA_CONFIG);

  // PLUGIN_TICKET_018: Data source state + two-phase loading
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    // Phase 1: Sync metadata (instant, status='checking')
    api.data.getProviderList().then((providers: Array<{
      id: string; name: string;
      capabilities?: { requiresAuth?: boolean; intervals?: string[]; maxLookback?: Record<string, string> }
    }>) => {
      const syncSources: DataSourceOption[] = providers.map((p) => ({
        id: p.id,
        name: p.name,
        status: 'checking' as const,
        requiresAuth: p.capabilities?.requiresAuth ?? false,
        intervals: p.capabilities?.intervals,
        maxLookback: p.capabilities?.maxLookback,
      }));
      setDataSources(syncSources);
    }).catch((error: unknown) => {
      console.error('[AlphaFactoryPage] Phase 1 failed:', error);
    });

    // Phase 2: TICKET_332 Progressive per-provider status events
    const unsubscribe = api.data.onProviderStatus((event: {
      id: string;
      status: 'connected' | 'disconnected' | 'error';
      latencyMs?: number;
    }) => {
      setDataSources((prev) =>
        prev.map((ds) =>
          ds.id === event.id
            ? { ...ds, status: event.status, latencyMs: event.latencyMs }
            : ds
        )
      );
    });
    api.data.checkProvidersProgressive();

    // Auth state
    let unsubAuth: (() => void) | undefined;
    if (api.auth) {
      api.auth.getState().then((result: { success: boolean; data?: { isAuthenticated: boolean } }) => {
        if (result.success && result.data) {
          setIsAuthenticated(result.data.isAuthenticated);
        }
      });

      // Subscribe to auth state changes
      unsubAuth = api.auth.onStateChanged((data: { isAuthenticated: boolean }) => {
        setIsAuthenticated(data.isAuthenticated);
      });
    }

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof unsubAuth === 'function') unsubAuth();
    };
  }, []);

  // PLUGIN_TICKET_015: Backtest hook
  const { status, progress, result, error, timeframeStatus, runBacktest } = useAlphaFactoryBacktest({
    signals,
    signalMethod,
    lookback,
    exitMethod,
    exitRules,
    // TICKET_276: Factor layer
    factors,
    factorMethod,
    factorLookback,
    dataConfig,
  });

  const isRunning = status === 'loading_data' || status === 'generating' || status === 'running';
  // TICKET_276: Hybrid model allows either signals > 0 OR factors > 0 (or both)
  const canRun = (signals.length > 0 || factors.length > 0) && !!dataConfig.symbol && !!dataConfig.startDate && !!dataConfig.endDate;

  // PLUGIN_TICKET_016: Auto-scroll to result section when backtest starts
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== 'idle') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status]);

  // TICKET_275: picker only for signals now (exit uses built-in rules)
  const [pickerVisible, setPickerVisible] = useState(false);
  // TICKET_276: Factor picker state
  const [factorPickerVisible, setFactorPickerVisible] = useState(false);

  // Signal handlers - PLUGIN_TICKET_007: open picker instead of creating placeholder
  const handleAddSignal = useCallback(() => {
    setPickerVisible(true);
  }, []);

  // TICKET_276: Factor handlers
  const handleAddFactor = useCallback(() => {
    setFactorPickerVisible(true);
  }, []);

  const handleSelectFactor = useCallback((factor: FactorChip) => {
    setFactors(prev => [...prev, factor]);
    setFactorPickerVisible(false);
  }, [setFactors]);

  const handleRemoveFactor = useCallback((id: string) => {
    setFactors(prev => prev.filter(f => f.id !== id));
  }, [setFactors]);

  // Build SignalChip from SignalSourceItem
  const buildChipFromSource = useCallback((source: SignalSourceItem): SignalChip => ({
    id: source.id,
    name: source.name,
    analysis: {
      algorithmName: source.analysis_algorithm_name,
      timeframe: source.analysis_timeframe,
    },
    entry: {
      algorithmName: source.entry_algorithm_name,
      timeframe: source.entry_timeframe,
    },
    exit: source.exit_algorithm_name && source.exit_timeframe
      ? {
          algorithmName: source.exit_algorithm_name,
          timeframe: source.exit_timeframe,
        }
      : undefined,
    sharpe: source.backtest_sharpe,
    winRate: source.backtest_win_rate,
    totalTrades: source.backtest_total_trades,
  }), []);

  // PLUGIN_TICKET_010: Populate component details from SignalSourceItem
  const handleSelectSource = useCallback((source: SignalSourceItem) => {
    const chip = buildChipFromSource(source);
    setSignals(prev => [...prev, chip]);
    setPickerVisible(false);
  }, [buildChipFromSource, setSignals]);

  const handleRemoveSignal = useCallback((id: string) => {
    setSignals(prev => prev.filter(s => s.id !== id));
  }, [setSignals]);

  // PLUGIN_TICKET_010: Update timeframe for a specific signal component
  const handleTimeframeChange = useCallback((
    signalId: string,
    component: 'analysis' | 'entry' | 'exit',
    timeframe: string,
  ) => {
    setSignals(prev => prev.map(s => {
      if (s.id !== signalId || !s[component]) return s;
      return {
        ...s,
        [component]: { ...s[component], timeframe },
      };
    }));
  }, [setSignals]);

  // Action handlers
  const handleValidate = useCallback(() => {
    // TODO: Implement validation
  }, []);

  const handleRunBacktest = useCallback(() => {
    runBacktest();
  }, [runBacktest]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* PLUGIN_TICKET_012: Config Sidebar */}
      <ConfigSidebar
        configs={configList}
        activeConfigId={configId}
        onNewConfig={createNewConfig}
        onSelectConfig={switchConfig}
        onDeleteConfig={deleteConfig}
        isLoading={isLoadingList}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <SignalFactorySection
            signals={signals}
            method={signalMethod}
            lookback={lookback}
            onAddSignal={handleAddSignal}
            onRemoveSignal={handleRemoveSignal}
            onMethodChange={setSignalMethod}
            onLookbackChange={setLookback}
            onTimeframeChange={handleTimeframeChange}
          />

          {/* PLUGIN_TICKET_007: Modal renders via portal, placed at page level */}
          {/* TICKET_275: Picker only for signals (usageType='signal' always) */}
          <SignalSourcePicker
            visible={pickerVisible}
            usageType="signal"
            onSelect={handleSelectSource}
            onClose={() => setPickerVisible(false)}
            excludeIds={signals.map(s => s.id)}
          />

          <FlowDivider />

          {/* TICKET_276: Factor Factory Section */}
          <FactorFactorySection
            factors={factors}
            method={factorMethod}
            lookback={factorLookback}
            onAddFactor={handleAddFactor}
            onRemoveFactor={handleRemoveFactor}
            onMethodChange={setFactorMethod}
            onLookbackChange={setFactorLookback}
          />

          {/* TICKET_276: Factor picker modal */}
          <FactorSourcePicker
            visible={factorPickerVisible}
            onSelect={handleSelectFactor}
            onClose={() => setFactorPickerVisible(false)}
            excludeIds={factors.map(f => f.id)}
          />

          <FlowDivider />

          {/* TICKET_275: Risk override panel replaces card grid */}
          <ExitFactorySection
            exitRules={exitRules}
            exitMethod={exitMethod}
            onExitRulesChange={setExitRules}
            onMethodChange={setExitMethod}
          />

          <FlowDivider />

          {/* PLUGIN_TICKET_015: Data Configuration */}
          <DataConfigPanel
            value={dataConfig}
            onChange={setDataConfig}
            disabled={isRunning}
            dataSources={dataSources}
            isAuthenticated={isAuthenticated}
          />

          <ActionBar
            onValidate={handleValidate}
            onSaveAs={saveAs}
            onRunBacktest={handleRunBacktest}
            isRunning={isRunning}
            canRun={canRun}
          />

          {/* PLUGIN_TICKET_016: Full result section */}
          <div ref={resultRef}>
            <ResultSection
              status={status}
              progress={progress}
              result={result}
              error={error}
              signals={signals}
              signalMethod={signalMethod}
              lookback={lookback}
              exitRules={exitRules}
              exitMethod={exitMethod}
              dataConfig={dataConfig}
              timeframeStatus={timeframeStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

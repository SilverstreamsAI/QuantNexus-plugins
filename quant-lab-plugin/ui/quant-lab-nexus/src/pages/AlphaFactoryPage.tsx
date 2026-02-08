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
import { SignalChip, DataConfig } from '../types';
import { DEFAULT_DATA_CONFIG } from '../constants';
import { SignalFactorySection } from '../components/SignalFactorySection';
import { ExitFactorySection } from '../components/ExitFactorySection';
import { FlowDivider } from '../components/FlowDivider';
import { ActionBar } from '../components/ActionBar';
import { DataConfigPanel } from '../components/DataConfigPanel';
import { ResultSection } from '../components/ResultSection';
import { SignalSourcePicker, SignalSourceItem } from '../components/SignalSourcePicker';
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

  // PLUGIN_TICKET_015: Backtest hook
  const { status, progress, result, error, runBacktest } = useAlphaFactoryBacktest({
    signals,
    signalMethod,
    lookback,
    exitMethod,
    exitRules,
    dataConfig,
  });

  const isRunning = status === 'loading_data' || status === 'generating' || status === 'running';
  const canRun = signals.length > 0 && !!dataConfig.symbol && !!dataConfig.startDate && !!dataConfig.endDate;

  // PLUGIN_TICKET_016: Auto-scroll to result section when backtest starts
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== 'idle') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [status]);

  // TICKET_275: picker only for signals now (exit uses built-in rules)
  const [pickerVisible, setPickerVisible] = useState(false);

  // Signal handlers - PLUGIN_TICKET_007: open picker instead of creating placeholder
  const handleAddSignal = useCallback(() => {
    setPickerVisible(true);
  }, []);

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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

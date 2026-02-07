/**
 * AlphaFactoryPage Component (Composition Layer)
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_004: Combinator Page UI
 * PLUGIN_TICKET_007: Signal source selection from registry
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * PLUGIN_TICKET_010: Populate component details, timeframe change handler
 * PLUGIN_TICKET_011: Config persistence delegated to useAlphaFactoryConfig hook
 *
 * Composes SignalFactorySection + FlowDivider + ExitFactorySection + ActionBar.
 * Manages signals, exits, combinator selections state.
 */

import React, { useState, useCallback } from 'react';
import { SignalChip } from '../types';
import { SignalFactorySection } from '../components/SignalFactorySection';
import { ExitFactorySection } from '../components/ExitFactorySection';
import { FlowDivider } from '../components/FlowDivider';
import { ActionBar } from '../components/ActionBar';
import { SignalSourcePicker, SignalSourceItem } from '../components/SignalSourcePicker';
import { useAlphaFactoryConfig } from '../hooks/useAlphaFactoryConfig';

export const AlphaFactoryPage: React.FC = () => {
  const {
    signals, setSignals,
    signalMethod, setSignalMethod,
    lookback, setLookback,
    exits, setExits,
    exitMethod, setExitMethod,
    saveAs,
  } = useAlphaFactoryConfig();

  const [pickerVisible, setPickerVisible] = useState(false);

  // Signal handlers - PLUGIN_TICKET_007: open picker instead of creating placeholder
  const handleAddSignal = useCallback(() => {
    setPickerVisible(true);
  }, []);

  // PLUGIN_TICKET_010: Populate component details from SignalSourceItem
  const handleSelectSignalSource = useCallback((source: SignalSourceItem) => {
    const chip: SignalChip = {
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
    };
    setSignals(prev => [...prev, chip]);
    setPickerVisible(false);
  }, [setSignals]);

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

  // Exit handlers
  const handleAddExit = useCallback(() => {
    const newId = String(Date.now());
    setExits(prev => [...prev, { id: newId, name: `Exit_${prev.length + 1}` }]);
  }, [setExits]);

  const handleRemoveExit = useCallback((id: string) => {
    setExits(prev => prev.filter(e => e.id !== id));
  }, [setExits]);

  // Action handlers
  const handleValidate = useCallback(() => {
    // TODO: Implement validation
  }, []);

  const handleRunBacktest = useCallback(() => {
    // TODO: Implement run backtest
  }, []);

  return (
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
        <SignalSourcePicker
          visible={pickerVisible}
          onSelect={handleSelectSignalSource}
          onClose={() => setPickerVisible(false)}
          excludeIds={signals.map(s => s.id)}
        />

        <FlowDivider />

        <ExitFactorySection
          exits={exits}
          method={exitMethod}
          onAddExit={handleAddExit}
          onRemoveExit={handleRemoveExit}
          onMethodChange={setExitMethod}
        />

        <FlowDivider />

        <ActionBar
          onValidate={handleValidate}
          onSaveAs={saveAs}
          onRunBacktest={handleRunBacktest}
        />
      </div>
    </div>
  );
};

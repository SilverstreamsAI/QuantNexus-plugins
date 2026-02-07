/**
 * AlphaFactoryPage Component (Composition Layer)
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_004: Combinator Page UI
 * PLUGIN_TICKET_007: Signal source selection from registry
 * PLUGIN_TICKET_008: Migrated from host to plugin
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

export const AlphaFactoryPage: React.FC = () => {
  // Signal Factory state - PLUGIN_TICKET_007: empty initial state (no hardcoded seeds)
  const [signals, setSignals] = useState<SignalChip[]>([]);
  const [signalMethod, setSignalMethod] = useState('sharpe_weighted');
  const [lookback, setLookback] = useState(60);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Exit Factory state
  const [exits, setExits] = useState<SignalChip[]>([
    { id: '1', name: 'TrailingStop' },
  ]);
  const [exitMethod, setExitMethod] = useState('any');

  // Signal handlers - PLUGIN_TICKET_007: open picker instead of creating placeholder
  const handleAddSignal = useCallback(() => {
    setPickerVisible(true);
  }, []);

  const handleSelectSignalSource = useCallback((source: SignalSourceItem) => {
    const chip: SignalChip = {
      id: source.id,
      name: source.name,
      sharpe: source.backtest_sharpe,
      winRate: source.backtest_win_rate,
      totalTrades: source.backtest_total_trades,
    };
    setSignals(prev => [...prev, chip]);
    setPickerVisible(false);
  }, []);

  const handleRemoveSignal = useCallback((id: string) => {
    setSignals(prev => prev.filter(s => s.id !== id));
  }, []);

  // Exit handlers
  const handleAddExit = useCallback(() => {
    const newId = String(Date.now());
    setExits(prev => [...prev, { id: newId, name: `Exit_${prev.length + 1}` }]);
  }, []);

  const handleRemoveExit = useCallback((id: string) => {
    setExits(prev => prev.filter(e => e.id !== id));
  }, []);

  // Action handlers
  const handleValidate = useCallback(() => {
    // TODO: Implement validation
  }, []);

  const handleSave = useCallback(() => {
    // TODO: Implement save workflow
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
          onSave={handleSave}
          onRunBacktest={handleRunBacktest}
        />
      </div>
    </div>
  );
};

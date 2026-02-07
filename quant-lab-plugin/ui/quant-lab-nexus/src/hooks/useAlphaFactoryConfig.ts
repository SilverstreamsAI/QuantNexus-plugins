/**
 * useAlphaFactoryConfig Hook
 *
 * PLUGIN_TICKET_011: Centralized config persistence for Alpha Factory.
 * Owns all config state, auto-loads on mount, debounced auto-save (500ms),
 * auto-creates "Default" config on first signal addition.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SignalChip } from '../types';

interface UseAlphaFactoryConfigReturn {
  signals: SignalChip[];
  setSignals: React.Dispatch<React.SetStateAction<SignalChip[]>>;
  signalMethod: string;
  setSignalMethod: React.Dispatch<React.SetStateAction<string>>;
  lookback: number;
  setLookback: React.Dispatch<React.SetStateAction<number>>;
  exits: SignalChip[];
  setExits: React.Dispatch<React.SetStateAction<SignalChip[]>>;
  exitMethod: string;
  setExitMethod: React.Dispatch<React.SetStateAction<string>>;
  configName: string;
  saveAs: () => Promise<void>;
}

export function useAlphaFactoryConfig(): UseAlphaFactoryConfigReturn {
  const [signals, setSignals] = useState<SignalChip[]>([]);
  const [signalMethod, setSignalMethod] = useState('sharpe_weighted');
  const [lookback, setLookback] = useState(60);
  const [exits, setExits] = useState<SignalChip[]>([
    { id: '1', name: 'TrailingStop' },
  ]);
  const [exitMethod, setExitMethod] = useState('any');
  const [configId, setConfigId] = useState<string | undefined>();
  const [configName, setConfigName] = useState('');

  // Refs to avoid stale closures in debounce timer
  const configIdRef = useRef(configId);
  const configNameRef = useRef(configName);
  const mountedRef = useRef(false);

  configIdRef.current = configId;
  configNameRef.current = configName;

  // Load active config on mount
  useEffect(() => {
    window.electronAPI.alphaFactory.loadConfig()
      .then(response => {
        if (response.success && response.data) {
          setSignals(response.data.signals as SignalChip[]);
          setSignalMethod(response.data.signalMethod);
          setLookback(response.data.lookback);
          setExits(response.data.exits as SignalChip[]);
          setExitMethod(response.data.exitMethod);
          setConfigId(response.data.id);
          setConfigName(response.data.name);
        }
        // Mark mounted after initial load completes to enable auto-save
        mountedRef.current = true;
      });
  }, []);

  // Debounced auto-save on state change (500ms)
  useEffect(() => {
    // Skip auto-save before initial load completes
    if (!mountedRef.current) return;
    // Nothing to save if no config and no signals
    if (!configIdRef.current && signals.length === 0) return;

    const timer = setTimeout(async () => {
      const name = configNameRef.current || 'Default';

      const response = await window.electronAPI.alphaFactory.saveConfig({
        id: configIdRef.current,
        name,
        signalMethod,
        lookback,
        signals,
        exitMethod,
        exits,
      });

      if (response.success && response.id) {
        setConfigId(response.id);
        if (!configNameRef.current) {
          setConfigName(name);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [signals, signalMethod, lookback, exits, exitMethod]);

  // Save As: prompt for name, create new config
  const saveAs = useCallback(async () => {
    const input = window.prompt('Enter configuration name:');
    if (!input || !input.trim()) return;

    const name = input.trim();

    const response = await window.electronAPI.alphaFactory.saveConfig({
      name,
      signalMethod,
      lookback,
      signals,
      exitMethod,
      exits,
    });

    if (response.success && response.id) {
      setConfigId(response.id);
      setConfigName(name);
    }
  }, [signalMethod, lookback, signals, exitMethod, exits]);

  return {
    signals,
    setSignals,
    signalMethod,
    setSignalMethod,
    lookback,
    setLookback,
    exits,
    setExits,
    exitMethod,
    setExitMethod,
    configName,
    saveAs,
  };
}

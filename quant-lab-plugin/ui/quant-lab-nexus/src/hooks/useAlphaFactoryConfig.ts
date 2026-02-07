/**
 * useAlphaFactoryConfig Hook
 *
 * PLUGIN_TICKET_011: Centralized config persistence for Alpha Factory.
 * PLUGIN_TICKET_012: Enhanced with config list, switch, create, delete for sidebar.
 *
 * Owns all config state, auto-loads on mount, debounced auto-save (500ms),
 * auto-creates "Default" config on first signal addition.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SignalChip, ConfigSummary } from '../types';

// -----------------------------------------------------------------------------
// Default state values
// -----------------------------------------------------------------------------

const DEFAULT_SIGNAL_METHOD = 'sharpe_weighted';
const DEFAULT_LOOKBACK = 60;
const DEFAULT_EXIT_METHOD = 'any';

// -----------------------------------------------------------------------------
// Return type
// -----------------------------------------------------------------------------

interface UseAlphaFactoryConfigReturn {
  // Existing fields (PLUGIN_TICKET_011)
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

  // PLUGIN_TICKET_012: Sidebar support
  configId: string | undefined;
  configList: ConfigSummary[];
  isLoadingList: boolean;
  switchConfig: (id: string) => Promise<void>;
  createNewConfig: () => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  refreshConfigList: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAlphaFactoryConfig(): UseAlphaFactoryConfigReturn {
  const [signals, setSignals] = useState<SignalChip[]>([]);
  const [signalMethod, setSignalMethod] = useState(DEFAULT_SIGNAL_METHOD);
  const [lookback, setLookback] = useState(DEFAULT_LOOKBACK);
  const [exits, setExits] = useState<SignalChip[]>([
    { id: '1', name: 'TrailingStop' },
  ]);
  const [exitMethod, setExitMethod] = useState(DEFAULT_EXIT_METHOD);
  const [configId, setConfigId] = useState<string | undefined>();
  const [configName, setConfigName] = useState('');

  // PLUGIN_TICKET_012: Config list state
  const [configList, setConfigList] = useState<ConfigSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Refs to avoid stale closures in debounce timer
  const configIdRef = useRef(configId);
  const configNameRef = useRef(configName);
  const mountedRef = useRef(false);

  configIdRef.current = configId;
  configNameRef.current = configName;

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Refresh config list from DB
  // ---------------------------------------------------------------------------

  const refreshConfigList = useCallback(async () => {
    const response = await window.electronAPI.alphaFactory.listConfigs();
    if (response.success && response.data) {
      setConfigList(response.data as ConfigSummary[]);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load active config + config list on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const init = async () => {
      const response = await window.electronAPI.alphaFactory.loadConfig();
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

      // PLUGIN_TICKET_012: Load config list
      await refreshConfigList();
    };
    init();
  }, [refreshConfigList]);

  // ---------------------------------------------------------------------------
  // Debounced auto-save on state change (500ms)
  // ---------------------------------------------------------------------------

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
        // PLUGIN_TICKET_012: Refresh list after auto-save (updates timestamps, counts)
        await refreshConfigList();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [signals, signalMethod, lookback, exits, exitMethod, refreshConfigList]);

  // ---------------------------------------------------------------------------
  // Save As: prompt for name, create new config
  // ---------------------------------------------------------------------------

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
      await refreshConfigList();
    }
  }, [signalMethod, lookback, signals, exitMethod, exits, refreshConfigList]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Switch to a different config
  // ---------------------------------------------------------------------------

  const switchConfig = useCallback(async (id: string) => {
    const response = await window.electronAPI.alphaFactory.loadConfig(id);
    if (!response.success || !response.data) return;

    const data = response.data;
    setSignals(data.signals as SignalChip[]);
    setSignalMethod(data.signalMethod);
    setLookback(data.lookback);
    setExits(data.exits as SignalChip[]);
    setExitMethod(data.exitMethod);
    setConfigId(data.id);
    setConfigName(data.name);

    // Mark as active by re-saving (save-config handler sets is_active=1)
    await window.electronAPI.alphaFactory.saveConfig({
      id: data.id,
      name: data.name,
      signalMethod: data.signalMethod,
      lookback: data.lookback,
      signals: data.signals as SignalChip[],
      exitMethod: data.exitMethod,
      exits: data.exits as SignalChip[],
    });

    await refreshConfigList();
  }, [refreshConfigList]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Create a new empty config
  // ---------------------------------------------------------------------------

  const createNewConfig = useCallback(async () => {
    const defaultSignals: SignalChip[] = [];
    const defaultExits: SignalChip[] = [];

    const response = await window.electronAPI.alphaFactory.saveConfig({
      name: 'Untitled',
      signalMethod: DEFAULT_SIGNAL_METHOD,
      lookback: DEFAULT_LOOKBACK,
      signals: defaultSignals,
      exitMethod: DEFAULT_EXIT_METHOD,
      exits: defaultExits,
    });

    if (response.success && response.id) {
      setSignals(defaultSignals);
      setSignalMethod(DEFAULT_SIGNAL_METHOD);
      setLookback(DEFAULT_LOOKBACK);
      setExits(defaultExits);
      setExitMethod(DEFAULT_EXIT_METHOD);
      setConfigId(response.id);
      setConfigName('Untitled');
      await refreshConfigList();
    }
  }, [refreshConfigList]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Delete a config
  // ---------------------------------------------------------------------------

  const deleteConfig = useCallback(async (id: string) => {
    const response = await window.electronAPI.alphaFactory.deleteConfig(id);
    if (!response.success) return;

    await refreshConfigList();

    // If deleted the active config, switch to first remaining or reset
    if (id === configIdRef.current) {
      const listResponse = await window.electronAPI.alphaFactory.listConfigs();
      const remaining = (listResponse.success && listResponse.data) ? listResponse.data : [];

      if (remaining.length > 0) {
        // Switch to the most recently updated config
        const next = remaining[0];
        const loadResponse = await window.electronAPI.alphaFactory.loadConfig(next.id);
        if (loadResponse.success && loadResponse.data) {
          const data = loadResponse.data;
          setSignals(data.signals as SignalChip[]);
          setSignalMethod(data.signalMethod);
          setLookback(data.lookback);
          setExits(data.exits as SignalChip[]);
          setExitMethod(data.exitMethod);
          setConfigId(data.id);
          setConfigName(data.name);
          // Mark as active
          await window.electronAPI.alphaFactory.saveConfig({
            id: data.id,
            name: data.name,
            signalMethod: data.signalMethod,
            lookback: data.lookback,
            signals: data.signals as SignalChip[],
            exitMethod: data.exitMethod,
            exits: data.exits as SignalChip[],
          });
          await refreshConfigList();
        }
      } else {
        // No configs left, reset to empty state
        setSignals([]);
        setSignalMethod(DEFAULT_SIGNAL_METHOD);
        setLookback(DEFAULT_LOOKBACK);
        setExits([]);
        setExitMethod(DEFAULT_EXIT_METHOD);
        setConfigId(undefined);
        setConfigName('');
      }
    }
  }, [refreshConfigList]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

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
    // PLUGIN_TICKET_012
    configId,
    configList,
    isLoadingList,
    switchConfig,
    createNewConfig,
    deleteConfig,
    refreshConfigList,
  };
}

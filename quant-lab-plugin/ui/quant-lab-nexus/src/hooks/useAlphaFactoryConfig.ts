/**
 * useAlphaFactoryConfig Hook
 *
 * PLUGIN_TICKET_011: Centralized config persistence for Alpha Factory.
 * PLUGIN_TICKET_012: Enhanced with config list, switch, create, delete for sidebar.
 * TICKET_275: exits -> exitRules (ExitRules object), format detection on load.
 *
 * Owns all config state, auto-loads on mount, debounced auto-save (500ms),
 * auto-creates "Default" config on first signal addition.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SignalChip, ExitRules, ConfigSummary } from '../types';
import { DEFAULT_EXIT_RULES } from '../constants';

// -----------------------------------------------------------------------------
// Default state values
// -----------------------------------------------------------------------------

const DEFAULT_SIGNAL_METHOD = 'sharpe_weighted';
const DEFAULT_LOOKBACK = 60;
const DEFAULT_EXIT_METHOD = 'any';

// -----------------------------------------------------------------------------
// Format detection helper
// -----------------------------------------------------------------------------

/**
 * TICKET_275: Detect if parsed exits data is new ExitRules format or legacy format.
 * New format: object with all 5 rule keys (circuitBreaker, timeLimit, regimeDetection,
 *             drawdownLimit, correlationCap). Discriminator: `timeLimit` key is unique
 *             to new schema (old schema used `trailingStop`/`timeCutoff`).
 * Legacy: old schema object or SignalChip[] array -> fall back to defaults.
 */
function parseExitRules(raw: unknown): ExitRules {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'timeLimit' in raw
  ) {
    return raw as ExitRules;
  }
  // Legacy schema, array format, or invalid: use defaults
  return { ...DEFAULT_EXIT_RULES };
}

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
  // TICKET_275: exitRules replaces exits
  exitRules: ExitRules;
  setExitRules: React.Dispatch<React.SetStateAction<ExitRules>>;
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
  // TICKET_275: ExitRules object instead of SignalChip[]
  const [exitRules, setExitRules] = useState<ExitRules>({ ...DEFAULT_EXIT_RULES });
  const [exitMethod, setExitMethod] = useState(DEFAULT_EXIT_METHOD);
  const [configId, setConfigId] = useState<string | undefined>();
  const [configName, setConfigName] = useState('');

  // PLUGIN_TICKET_012: Config list state
  const [configList, setConfigList] = useState<ConfigSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Refs to avoid stale closures in debounce timer
  const configIdRef = useRef(configId);
  const configNameRef = useRef(configName);
  const signalsRef = useRef(signals);
  const exitRulesRef = useRef(exitRules);
  const mountedRef = useRef(false);
  // Skip auto-save when state changes are from config switching (not user edits)
  const skipAutoSaveRef = useRef(false);

  configIdRef.current = configId;
  configNameRef.current = configName;
  signalsRef.current = signals;
  exitRulesRef.current = exitRules;

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
  // PLUGIN_TICKET_012: Auto-cleanup empty "Untitled" configs
  // Returns deleted config ID or null
  // ---------------------------------------------------------------------------

  const cleanupCurrentIfEmpty = useCallback(async (): Promise<string | null> => {
    const id = configIdRef.current;
    if (!id) return null;
    if (configNameRef.current !== 'Untitled') return null;
    if (signalsRef.current.length > 0) return null;

    await window.electronAPI.alphaFactory.deleteConfig(id);
    return id;
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
        // TICKET_275: format detection
        setExitRules(parseExitRules(response.data.exits));
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
    // Skip auto-save during config switching / creation (DB already up-to-date)
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
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
        exits: exitRules,
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
  }, [signals, signalMethod, lookback, exitRules, exitMethod, refreshConfigList]);

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
      exits: exitRules,
    });

    if (response.success && response.id) {
      skipAutoSaveRef.current = true;
      setConfigId(response.id);
      setConfigName(name);
      await refreshConfigList();
    }
  }, [signalMethod, lookback, signals, exitMethod, exitRules, refreshConfigList]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Switch to a different config
  // ---------------------------------------------------------------------------

  const switchConfig = useCallback(async (id: string) => {
    // Auto-cleanup: delete current config if empty "Untitled"
    const cleanedId = await cleanupCurrentIfEmpty();

    const response = await window.electronAPI.alphaFactory.loadConfig(id);
    if (!response.success || !response.data) return;

    // Suppress auto-save (DB already has correct data for this config)
    skipAutoSaveRef.current = true;

    const data = response.data;
    setSignals(data.signals as SignalChip[]);
    setSignalMethod(data.signalMethod);
    setLookback(data.lookback);
    // TICKET_275: format detection
    setExitRules(parseExitRules(data.exits));
    setExitMethod(data.exitMethod);
    setConfigId(data.id);
    setConfigName(data.name);

    // Mark as active in DB (for persistence across restarts)
    await window.electronAPI.alphaFactory.saveConfig({
      id: data.id,
      name: data.name,
      signalMethod: data.signalMethod,
      lookback: data.lookback,
      signals: data.signals as SignalChip[],
      exitMethod: data.exitMethod,
      exits: parseExitRules(data.exits),
    });

    // Update list locally: remove cleaned config + toggle isActive (preserve order)
    setConfigList(prev => {
      let list = prev;
      if (cleanedId) {
        list = list.filter(c => c.id !== cleanedId);
      }
      return list.map(c => ({
        ...c,
        isActive: c.id === id,
      }));
    });
  }, [cleanupCurrentIfEmpty]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Create a new empty config
  // ---------------------------------------------------------------------------

  const createNewConfig = useCallback(async () => {
    // Auto-cleanup: delete current config if empty "Untitled"
    await cleanupCurrentIfEmpty();

    const defaultSignals: SignalChip[] = [];
    const defaultRules = { ...DEFAULT_EXIT_RULES };

    const response = await window.electronAPI.alphaFactory.saveConfig({
      name: 'Untitled',
      signalMethod: DEFAULT_SIGNAL_METHOD,
      lookback: DEFAULT_LOOKBACK,
      signals: defaultSignals,
      exitMethod: DEFAULT_EXIT_METHOD,
      exits: defaultRules,
    });

    if (response.success && response.id) {
      // Suppress auto-save (just saved to DB)
      skipAutoSaveRef.current = true;
      setSignals(defaultSignals);
      setSignalMethod(DEFAULT_SIGNAL_METHOD);
      setLookback(DEFAULT_LOOKBACK);
      setExitRules(defaultRules);
      setExitMethod(DEFAULT_EXIT_METHOD);
      setConfigId(response.id);
      setConfigName('Untitled');
      await refreshConfigList();
    }
  }, [cleanupCurrentIfEmpty, refreshConfigList]);

  // ---------------------------------------------------------------------------
  // PLUGIN_TICKET_012: Delete a config
  // ---------------------------------------------------------------------------

  const deleteConfig = useCallback(async (id: string) => {
    const response = await window.electronAPI.alphaFactory.deleteConfig(id);
    if (!response.success) return;

    // If deleted the active config, switch to first remaining or reset
    if (id === configIdRef.current) {
      const listResponse = await window.electronAPI.alphaFactory.listConfigs();
      const remaining = (listResponse.success && listResponse.data) ? listResponse.data : [];

      if (remaining.length > 0) {
        const next = remaining[0];
        const loadResponse = await window.electronAPI.alphaFactory.loadConfig(next.id);
        if (loadResponse.success && loadResponse.data) {
          skipAutoSaveRef.current = true;
          const data = loadResponse.data;
          setSignals(data.signals as SignalChip[]);
          setSignalMethod(data.signalMethod);
          setLookback(data.lookback);
          // TICKET_275: format detection
          setExitRules(parseExitRules(data.exits));
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
            exits: parseExitRules(data.exits),
          });
        }
      } else {
        // No configs left, reset to empty state
        skipAutoSaveRef.current = true;
        setSignals([]);
        setSignalMethod(DEFAULT_SIGNAL_METHOD);
        setLookback(DEFAULT_LOOKBACK);
        setExitRules({ ...DEFAULT_EXIT_RULES });
        setExitMethod(DEFAULT_EXIT_METHOD);
        setConfigId(undefined);
        setConfigName('');
      }
    }

    await refreshConfigList();
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
    exitRules,
    setExitRules,
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

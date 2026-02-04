/**
 * Alpha Factory Page
 *
 * TICKET_250_11: Main Alpha Factory configuration and execution page
 */

import React, { useState, useCallback } from 'react';
import { SignalFlowCanvas } from '../components/SignalFlowCanvas';
import { CombinatorConfig } from '../components/CombinatorConfig';
import { useAlphaFactory } from '../hooks/useAlphaFactory';

interface SignalSourceConfig {
  type: string;
  name: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

interface CombinatorConfigType {
  method: string;
  params: Record<string, unknown>;
}

export const AlphaFactoryPage: React.FC = () => {
  const [signalSources, setSignalSources] = useState<SignalSourceConfig[]>([
    { type: 'rsi', name: 'RSI(14)', params: { period: 14 }, enabled: true },
    { type: 'macd', name: 'MACD(12,26,9)', params: {}, enabled: true },
    { type: 'sma_cross', name: 'SMA Cross(10,30)', params: { fast_period: 10, slow_period: 30 }, enabled: true },
  ]);

  const [combinator, setCombinator] = useState<CombinatorConfigType>({
    method: 'equal_weight',
    params: {},
  });

  const { execute, isRunning, progress, result, error } = useAlphaFactory();

  const handleExecute = useCallback(async () => {
    const config = {
      alphaFactory: {
        signal_sources: signalSources
          .filter(s => s.enabled)
          .map(s => ({ type: s.type, name: s.name, params: s.params })),
        combinator,
      },
      data: {
        symbol: 'BTCUSDT',
        interval: '1h',
        dataPath: '', // TODO: Configure data source
      },
    };

    await execute(config);
  }, [signalSources, combinator, execute]);

  const handleSignalToggle = useCallback((index: number) => {
    setSignalSources(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], enabled: !updated[index].enabled };
      return updated;
    });
  }, []);

  return (
    <div className="alpha-factory-page">
      <div className="page-header">
        <h1>Alpha Factory</h1>
        <p className="subtitle">Signal combination and evaluation</p>
      </div>

      <div className="content-grid">
        {/* Signal Sources */}
        <section className="signal-sources-section">
          <h2>Signal Sources</h2>
          <div className="signal-list">
            {signalSources.map((source, index) => (
              <div
                key={index}
                className={`signal-item ${source.enabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleSignalToggle(index)}
              >
                <span className="signal-name">{source.name}</span>
                <span className="signal-type">{source.type}</span>
                <span className={`toggle ${source.enabled ? 'on' : 'off'}`}>
                  {source.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
          <button className="add-signal-btn">+ Add Signal Source</button>
        </section>

        {/* Signal Flow Visualization */}
        <section className="flow-section">
          <h2>Signal Flow</h2>
          <SignalFlowCanvas
            signalSources={signalSources.filter(s => s.enabled)}
            combinator={combinator}
          />
        </section>

        {/* Combinator Configuration */}
        <section className="combinator-section">
          <h2>Combinator</h2>
          <CombinatorConfig
            config={combinator}
            onChange={setCombinator}
          />
        </section>

        {/* Execution */}
        <section className="execution-section">
          <h2>Execution</h2>
          <div className="execution-controls">
            <button
              className="execute-btn"
              onClick={handleExecute}
              disabled={isRunning}
            >
              {isRunning ? `Running... ${progress.toFixed(0)}%` : 'Execute'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {result && (
            <div className="result-summary">
              <h3>Results</h3>
              <div className="metric">
                <span>Signal Count:</span>
                <span>{result.signalCount}</span>
              </div>
              <div className="metric">
                <span>Bar Count:</span>
                <span>{result.barCount}</span>
              </div>
              <div className="metric">
                <span>Execution Time:</span>
                <span>{result.executionTimeMs}ms</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .alpha-factory-page {
          padding: 24px;
          color: var(--color-text-primary);
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          font-size: 24px;
          margin: 0;
        }

        .subtitle {
          color: var(--color-text-secondary);
          margin: 4px 0 0;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 300px 1fr 300px;
          gap: 24px;
        }

        section {
          background: var(--color-surface);
          border-radius: 8px;
          padding: 16px;
        }

        section h2 {
          font-size: 16px;
          margin: 0 0 16px;
          color: var(--color-text-primary);
        }

        .signal-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .signal-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--color-surface-elevated);
          border-radius: 4px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .signal-item.disabled {
          opacity: 0.5;
        }

        .signal-name {
          flex: 1;
          font-weight: 500;
        }

        .signal-type {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .toggle {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .toggle.on {
          background: var(--color-success);
          color: white;
        }

        .toggle.off {
          background: var(--color-surface);
        }

        .add-signal-btn {
          margin-top: 12px;
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px dashed var(--color-border);
          border-radius: 4px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .add-signal-btn:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .flow-section {
          grid-row: span 2;
        }

        .execution-controls {
          display: flex;
          gap: 12px;
        }

        .execute-btn {
          flex: 1;
          padding: 12px;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }

        .execute-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-message {
          margin-top: 12px;
          padding: 12px;
          background: var(--color-error-bg);
          border: 1px solid var(--color-error);
          border-radius: 4px;
          color: var(--color-error);
        }

        .result-summary {
          margin-top: 12px;
        }

        .result-summary h3 {
          font-size: 14px;
          margin: 0 0 8px;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

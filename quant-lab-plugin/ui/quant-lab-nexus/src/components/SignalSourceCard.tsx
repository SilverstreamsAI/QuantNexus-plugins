/**
 * Signal Source Card Component
 *
 * TICKET_250_11: Display signal source info with add action
 */

import React from 'react';

interface SignalSourceProps {
  signal: {
    id: string;
    name: string;
    description: string;
    category: string;
    params: Array<{
      name: string;
      type: string;
      default: unknown;
      description: string;
    }>;
  };
  onAdd: () => void;
}

export const SignalSourceCard: React.FC<SignalSourceProps> = ({ signal, onAdd }) => {
  return (
    <div className="signal-source-card">
      <div className="card-header">
        <h3 className="signal-name">{signal.name}</h3>
        <span className="signal-category">{signal.category}</span>
      </div>

      <p className="signal-description">{signal.description}</p>

      {signal.params.length > 0 && (
        <div className="params-section">
          <h4>Parameters</h4>
          <div className="params-list">
            {signal.params.map(param => (
              <div key={param.name} className="param-item">
                <span className="param-name">{param.name}</span>
                <span className="param-default">
                  {String(param.default)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="add-btn" onClick={onAdd}>
        + Add to Factory
      </button>

      <style>{`
        .signal-source-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 16px;
          transition: border-color 0.2s;
        }

        .signal-source-card:hover {
          border-color: var(--color-primary);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .signal-name {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .signal-category {
          font-size: 12px;
          padding: 2px 8px;
          background: var(--color-surface-elevated);
          border-radius: 12px;
          color: var(--color-text-secondary);
        }

        .signal-description {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0 0 12px;
          line-height: 1.4;
        }

        .params-section {
          margin-bottom: 12px;
        }

        .params-section h4 {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin: 0 0 8px;
          text-transform: uppercase;
        }

        .params-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .param-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .param-name {
          color: var(--color-text-secondary);
        }

        .param-default {
          color: var(--color-text-primary);
          font-family: monospace;
        }

        .add-btn {
          width: 100%;
          padding: 8px;
          background: transparent;
          border: 1px solid var(--color-primary);
          border-radius: 4px;
          color: var(--color-primary);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-btn:hover {
          background: var(--color-primary);
          color: white;
        }
      `}</style>
    </div>
  );
};

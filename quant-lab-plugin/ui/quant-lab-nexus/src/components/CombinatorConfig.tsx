/**
 * Combinator Config Component
 *
 * TICKET_250_11: Configure signal combination method
 */

import React from 'react';

interface CombinatorConfigType {
  method: string;
  params: Record<string, unknown>;
}

interface CombinatorConfigProps {
  config: CombinatorConfigType;
  onChange: (config: CombinatorConfigType) => void;
}

const COMBINATOR_METHODS = [
  {
    id: 'equal_weight',
    name: 'Equal Weight',
    description: 'Simple average of all signals',
    params: [],
  },
  {
    id: 'voting',
    name: 'Voting',
    description: 'Majority vote (count bullish vs bearish)',
    params: [
      { name: 'threshold', type: 'float', default: 0.0, description: 'Signal threshold' },
    ],
  },
  {
    id: 'sharpe_weighted',
    name: 'Sharpe Weighted',
    description: 'Weight by historical Sharpe ratio',
    params: [
      { name: 'lookback', type: 'int', default: 20, description: 'Lookback period' },
    ],
  },
  {
    id: 'correlation_adjusted',
    name: 'Correlation Adjusted',
    description: 'Penalize highly correlated signals',
    params: [
      { name: 'lookback', type: 'int', default: 50, description: 'Lookback period' },
    ],
  },
];

export const CombinatorConfig: React.FC<CombinatorConfigProps> = ({ config, onChange }) => {
  const selectedMethod = COMBINATOR_METHODS.find(m => m.id === config.method);

  const handleMethodChange = (methodId: string) => {
    const method = COMBINATOR_METHODS.find(m => m.id === methodId);
    if (method) {
      const params: Record<string, unknown> = {};
      for (const p of method.params) {
        params[p.name] = p.default;
      }
      onChange({ method: methodId, params });
    }
  };

  const handleParamChange = (name: string, value: unknown) => {
    onChange({
      ...config,
      params: { ...config.params, [name]: value },
    });
  };

  return (
    <div className="combinator-config">
      <div className="method-selector">
        {COMBINATOR_METHODS.map(method => (
          <div
            key={method.id}
            className={`method-option ${config.method === method.id ? 'selected' : ''}`}
            onClick={() => handleMethodChange(method.id)}
          >
            <span className="method-name">{method.name}</span>
            <span className="method-desc">{method.description}</span>
          </div>
        ))}
      </div>

      {selectedMethod && selectedMethod.params.length > 0 && (
        <div className="params-section">
          <h4>Parameters</h4>
          {selectedMethod.params.map(param => (
            <div key={param.name} className="param-row">
              <label>{param.name}</label>
              <input
                type={param.type === 'int' ? 'number' : 'text'}
                value={String(config.params[param.name] ?? param.default)}
                onChange={e => {
                  const value = param.type === 'int'
                    ? parseInt(e.target.value, 10)
                    : param.type === 'float'
                      ? parseFloat(e.target.value)
                      : e.target.value;
                  handleParamChange(param.name, value);
                }}
              />
              <span className="param-hint">{param.description}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .combinator-config {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .method-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .method-option {
          padding: 12px;
          background: var(--color-surface-elevated);
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .method-option:hover {
          border-color: var(--color-border);
        }

        .method-option.selected {
          border-color: var(--color-primary);
          background: var(--color-primary-bg);
        }

        .method-name {
          display: block;
          font-weight: 500;
          margin-bottom: 2px;
        }

        .method-desc {
          display: block;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .params-section h4 {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin: 0 0 8px;
          text-transform: uppercase;
        }

        .param-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 12px;
        }

        .param-row label {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .param-row input {
          padding: 8px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-text-primary);
          font-size: 14px;
        }

        .param-row input:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .param-hint {
          font-size: 11px;
          color: var(--color-text-tertiary);
        }
      `}</style>
    </div>
  );
};

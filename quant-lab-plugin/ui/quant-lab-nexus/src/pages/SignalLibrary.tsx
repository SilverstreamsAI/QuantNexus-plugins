/**
 * Signal Library Page
 *
 * TICKET_250_11: Browse and manage signal sources
 */

import React, { useState, useMemo } from 'react';
import { SignalSourceCard } from '../components/SignalSourceCard';

interface SignalSource {
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
}

const BUILT_IN_SIGNALS: SignalSource[] = [
  {
    id: 'rsi',
    name: 'RSI',
    description: 'Relative Strength Index - Momentum oscillator measuring speed and change of price movements',
    category: 'Momentum',
    params: [
      { name: 'period', type: 'int', default: 14, description: 'RSI calculation period' },
      { name: 'overbought', type: 'float', default: 70, description: 'Overbought threshold' },
      { name: 'oversold', type: 'float', default: 30, description: 'Oversold threshold' },
    ],
  },
  {
    id: 'macd',
    name: 'MACD',
    description: 'Moving Average Convergence Divergence - Trend-following momentum indicator',
    category: 'Trend',
    params: [
      { name: 'fast_period', type: 'int', default: 12, description: 'Fast EMA period' },
      { name: 'slow_period', type: 'int', default: 26, description: 'Slow EMA period' },
      { name: 'signal_period', type: 'int', default: 9, description: 'Signal line period' },
    ],
  },
  {
    id: 'sma_cross',
    name: 'SMA Crossover',
    description: 'Simple Moving Average Crossover - Classic trend following signal',
    category: 'Trend',
    params: [
      { name: 'fast_period', type: 'int', default: 10, description: 'Fast SMA period' },
      { name: 'slow_period', type: 'int', default: 30, description: 'Slow SMA period' },
    ],
  },
  {
    id: 'bollinger',
    name: 'Bollinger Bands',
    description: 'Volatility bands placed above and below a moving average',
    category: 'Volatility',
    params: [
      { name: 'period', type: 'int', default: 20, description: 'SMA period' },
      { name: 'std_dev', type: 'float', default: 2.0, description: 'Standard deviation multiplier' },
    ],
  },
  {
    id: 'atr',
    name: 'ATR',
    description: 'Average True Range - Volatility indicator',
    category: 'Volatility',
    params: [
      { name: 'period', type: 'int', default: 14, description: 'ATR calculation period' },
    ],
  },
  {
    id: 'obv',
    name: 'OBV',
    description: 'On-Balance Volume - Volume-based trend confirmation',
    category: 'Volume',
    params: [],
  },
];

const CATEGORIES = ['All', 'Trend', 'Momentum', 'Volatility', 'Volume', 'Pattern', 'Custom'];

export const SignalLibraryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredSignals = useMemo(() => {
    return BUILT_IN_SIGNALS.filter(signal => {
      const matchesSearch = searchQuery === '' ||
        signal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        signal.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' ||
        signal.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="signal-library-page">
      <div className="page-header">
        <h1>Signal Library</h1>
        <p className="subtitle">Browse and add signal sources to your Alpha Factory</p>
      </div>

      <div className="filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search signals..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <div className="category-tabs">
          {CATEGORIES.map(category => (
            <button
              key={category}
              className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="signal-grid">
        {filteredSignals.map(signal => (
          <SignalSourceCard
            key={signal.id}
            signal={signal}
            onAdd={() => {
              console.log('Add signal:', signal.id);
              // TODO: Integrate with Alpha Factory configuration
            }}
          />
        ))}
      </div>

      {filteredSignals.length === 0 && (
        <div className="no-results">
          No signals found matching your criteria
        </div>
      )}

      <style>{`
        .signal-library-page {
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

        .filters {
          margin-bottom: 24px;
        }

        .search-input {
          width: 100%;
          max-width: 400px;
          padding: 10px 16px;
          font-size: 14px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-text-primary);
          margin-bottom: 16px;
        }

        .search-input::placeholder {
          color: var(--color-text-tertiary);
        }

        .category-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .category-tab {
          padding: 6px 16px;
          font-size: 14px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 20px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-tab:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .category-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .signal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .no-results {
          text-align: center;
          padding: 48px;
          color: var(--color-text-tertiary);
        }
      `}</style>
    </div>
  );
};

/**
 * ChartSettings - Chart settings panel
 *
 * Sidebar component for configuring chart parameters
 */

import React, { useState } from 'react';

// =============================================================================
// Types
// =============================================================================

interface ChartSettingsProps {
  className?: string;
}

interface IndicatorConfig {
  id: string;
  name: string;
  enabled: boolean;
  params: Record<string, number>;
}

// =============================================================================
// Default Indicators
// =============================================================================

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: 'sma', name: 'SMA', enabled: false, params: { period: 20 } },
  { id: 'ema', name: 'EMA', enabled: false, params: { period: 12 } },
  { id: 'rsi', name: 'RSI', enabled: false, params: { period: 14 } },
  { id: 'macd', name: 'MACD', enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
  { id: 'bb', name: 'Bollinger Bands', enabled: false, params: { period: 20, stdDev: 2 } },
];

// =============================================================================
// ChartSettings Component
// =============================================================================

export function ChartSettings({ className }: ChartSettingsProps): JSX.Element {
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);

  const toggleIndicator = (id: string) => {
    setIndicators(prev =>
      prev.map(ind =>
        ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
      )
    );
  };

  const updateParam = (id: string, param: string, value: number) => {
    setIndicators(prev =>
      prev.map(ind =>
        ind.id === id ? { ...ind, params: { ...ind.params, [param]: value } } : ind
      )
    );
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-gray-200 ${className ?? ''}`}>
      {/* Indicators Section */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Indicators
        </h3>

        <div className="space-y-2">
          {indicators.map(indicator => (
            <div key={indicator.id} className="bg-gray-800 rounded-lg overflow-hidden">
              {/* Indicator Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-700/50"
                onClick={() => setExpandedIndicator(
                  expandedIndicator === indicator.id ? null : indicator.id
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={indicator.enabled}
                    onChange={() => toggleIndicator(indicator.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm font-medium">{indicator.name}</span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedIndicator === indicator.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Indicator Parameters */}
              {expandedIndicator === indicator.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-700">
                  {Object.entries(indicator.params).map(([param, value]) => (
                    <div key={param} className="flex items-center justify-between mt-2">
                      <label className="text-xs text-gray-400 capitalize">{param}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => updateParam(indicator.id, param, Number(e.target.value))}
                        className="w-20 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-right"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700 mx-4" />

      {/* Style Section */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Style
        </h3>

        <div className="space-y-3">
          {/* Chart Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Chart Type</label>
            <select className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded">
              <option value="candles">Candlesticks</option>
              <option value="hollow">Hollow Candles</option>
              <option value="ohlc">OHLC</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Up Color</label>
              <input
                type="color"
                defaultValue="#22c55e"
                className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Down Color</label>
              <input
                type="color"
                defaultValue="#ef4444"
                className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700 mx-4" />

      {/* Drawing Tools Section */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Drawing Tools
        </h3>

        <div className="grid grid-cols-4 gap-2">
          {['Line', 'Ray', 'Rect', 'Fib'].map(tool => (
            <button
              key={tool}
              className="p-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded"
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Apply Button */}
      <div className="p-4 border-t border-gray-700">
        <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded">
          Apply Changes
        </button>
      </div>
    </div>
  );
}

export default ChartSettings;

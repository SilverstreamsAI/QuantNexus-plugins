/**
 * Signal Trace Viewer Component
 *
 * TICKET_250_13: Debug visualization for signal flow tracing
 */

import React, { useState, useMemo } from 'react';

interface TraceEntry {
  barIndex: number;
  nodeId: string;
  signal: {
    value: number;
    direction: number;
    confidence: number;
  };
  layer: string;
  timestampNs: number;
}

interface SignalTraceViewerProps {
  traces: TraceEntry[];
  selectedBar?: number;
  onBarSelect?: (barIndex: number) => void;
}

export const SignalTraceViewer: React.FC<SignalTraceViewerProps> = ({
  traces,
  selectedBar,
  onBarSelect,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Group traces by bar
  const tracesByBar = useMemo(() => {
    const grouped = new Map<number, TraceEntry[]>();

    for (const trace of traces) {
      const existing = grouped.get(trace.barIndex) || [];
      existing.push(trace);
      grouped.set(trace.barIndex, existing);
    }

    return grouped;
  }, [traces]);

  // Get unique bar indices
  const barIndices = useMemo(() => {
    return Array.from(tracesByBar.keys()).sort((a, b) => a - b);
  }, [tracesByBar]);

  // Get traces for selected bar
  const selectedTraces = useMemo(() => {
    if (selectedBar === undefined) return [];
    return tracesByBar.get(selectedBar) || [];
  }, [tracesByBar, selectedBar]);

  // Get unique node IDs
  const nodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const trace of traces) {
      ids.add(trace.nodeId);
    }
    return Array.from(ids);
  }, [traces]);

  const formatSignalValue = (value: number): string => {
    return value.toFixed(4);
  };

  const getDirectionLabel = (direction: number): string => {
    if (direction > 0) return 'LONG';
    if (direction < 0) return 'SHORT';
    return 'NEUTRAL';
  };

  const getDirectionColor = (direction: number): string => {
    if (direction > 0) return 'var(--color-success)';
    if (direction < 0) return 'var(--color-error)';
    return 'var(--color-text-tertiary)';
  };

  return (
    <div className="signal-trace-viewer">
      <div className="viewer-header">
        <h3>Signal Trace</h3>
        <div className="view-toggle">
          <button
            className={viewMode === 'table' ? 'active' : ''}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            className={viewMode === 'chart' ? 'active' : ''}
            onClick={() => setViewMode('chart')}
          >
            Chart
          </button>
        </div>
      </div>

      {traces.length === 0 ? (
        <div className="no-traces">
          No trace data available. Enable tracing in Alpha Factory settings.
        </div>
      ) : (
        <>
          {/* Bar selector */}
          <div className="bar-selector">
            <label>Bar:</label>
            <select
              value={selectedBar ?? ''}
              onChange={e => onBarSelect?.(parseInt(e.target.value, 10))}
            >
              <option value="">Select bar...</option>
              {barIndices.slice(-100).map(idx => (
                <option key={idx} value={idx}>
                  Bar {idx}
                </option>
              ))}
            </select>
            <span className="bar-count">{barIndices.length} bars traced</span>
          </div>

          {viewMode === 'table' && selectedTraces.length > 0 && (
            <table className="trace-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Layer</th>
                  <th>Value</th>
                  <th>Direction</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {selectedTraces.map((trace, index) => (
                  <tr key={index}>
                    <td className="node-id">{trace.nodeId}</td>
                    <td className="layer">{trace.layer}</td>
                    <td className="value">{formatSignalValue(trace.signal.value)}</td>
                    <td style={{ color: getDirectionColor(trace.signal.direction) }}>
                      {getDirectionLabel(trace.signal.direction)}
                    </td>
                    <td className="confidence">{trace.signal.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {viewMode === 'chart' && (
            <div className="trace-chart">
              <svg width="100%" height="200" viewBox="0 0 600 200">
                {/* Y-axis */}
                <line x1="50" y1="20" x2="50" y2="180" stroke="var(--color-border)" />
                <text x="45" y="25" textAnchor="end" fontSize="10" fill="var(--color-text-tertiary)">1</text>
                <text x="45" y="105" textAnchor="end" fontSize="10" fill="var(--color-text-tertiary)">0</text>
                <text x="45" y="180" textAnchor="end" fontSize="10" fill="var(--color-text-tertiary)">-1</text>

                {/* X-axis */}
                <line x1="50" y1="100" x2="580" y2="100" stroke="var(--color-border)" strokeDasharray="2,2" />

                {/* Plot lines for each node */}
                {nodeIds.map((nodeId, nodeIndex) => {
                  const nodeTraces = traces.filter(t => t.nodeId === nodeId);
                  if (nodeTraces.length < 2) return null;

                  const color = `hsl(${(nodeIndex * 60) % 360}, 70%, 50%)`;

                  const points = nodeTraces
                    .map((t, i) => {
                      const x = 50 + (i / (nodeTraces.length - 1)) * 530;
                      const y = 100 - t.signal.value * 80;
                      return `${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <polyline
                      key={nodeId}
                      points={points}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.7"
                    />
                  );
                })}
              </svg>

              <div className="chart-legend">
                {nodeIds.map((nodeId, index) => (
                  <div key={nodeId} className="legend-item">
                    <span
                      className="legend-color"
                      style={{ background: `hsl(${(index * 60) % 360}, 70%, 50%)` }}
                    />
                    <span>{nodeId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .signal-trace-viewer {
          background: var(--color-surface);
          border-radius: 8px;
          padding: 16px;
        }

        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .viewer-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .view-toggle {
          display: flex;
          gap: 4px;
        }

        .view-toggle button {
          padding: 4px 12px;
          font-size: 12px;
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .view-toggle button.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .no-traces {
          padding: 32px;
          text-align: center;
          color: var(--color-text-tertiary);
        }

        .bar-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .bar-selector label {
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .bar-selector select {
          padding: 6px 8px;
          background: var(--color-surface-elevated);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-text-primary);
          font-size: 13px;
        }

        .bar-count {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-left: auto;
        }

        .trace-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .trace-table th {
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .trace-table td {
          padding: 8px;
          border-bottom: 1px solid var(--color-border);
        }

        .trace-table .node-id {
          font-family: monospace;
        }

        .trace-table .value {
          font-family: monospace;
        }

        .trace-table .layer {
          color: var(--color-text-secondary);
        }

        .trace-chart {
          background: var(--color-surface-elevated);
          border-radius: 6px;
          padding: 12px;
        }

        .chart-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }

        .chart-legend .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        .chart-legend .legend-color {
          width: 12px;
          height: 3px;
          border-radius: 1px;
        }
      `}</style>
    </div>
  );
};

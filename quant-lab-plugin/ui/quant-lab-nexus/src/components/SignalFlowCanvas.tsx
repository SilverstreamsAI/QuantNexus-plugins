/**
 * Signal Flow Canvas Component
 *
 * TICKET_250_11: Visualize signal flow using react-flow
 */

import React, { useMemo } from 'react';

interface SignalSourceConfig {
  type: string;
  name: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

interface CombinatorConfig {
  method: string;
  params: Record<string, unknown>;
}

interface SignalFlowCanvasProps {
  signalSources: SignalSourceConfig[];
  combinator: CombinatorConfig;
}

export const SignalFlowCanvas: React.FC<SignalFlowCanvasProps> = ({
  signalSources,
  combinator,
}) => {
  // Build flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const n: Array<{ id: string; type: string; x: number; y: number; label: string }> = [];
    const e: Array<{ id: string; source: string; target: string }> = [];

    // Signal source nodes
    signalSources.forEach((source, index) => {
      const nodeId = `source_${index}`;
      n.push({
        id: nodeId,
        type: 'source',
        x: 50,
        y: 50 + index * 80,
        label: source.name,
      });

      // Connect to combinator
      e.push({
        id: `${nodeId}_to_combinator`,
        source: nodeId,
        target: 'combinator',
      });
    });

    // Combinator node
    n.push({
      id: 'combinator',
      type: 'combinator',
      x: 250,
      y: 50 + (signalSources.length - 1) * 40,
      label: combinator.method.replace('_', ' '),
    });

    // Output node
    n.push({
      id: 'output',
      type: 'output',
      x: 450,
      y: 50 + (signalSources.length - 1) * 40,
      label: 'Combined Signal',
    });

    e.push({
      id: 'combinator_to_output',
      source: 'combinator',
      target: 'output',
    });

    return { nodes: n, edges: e };
  }, [signalSources, combinator]);

  // Simple SVG-based visualization (react-flow requires additional setup)
  return (
    <div className="signal-flow-canvas">
      <svg width="100%" height={Math.max(300, nodes.length * 80)} viewBox="0 0 550 300">
        {/* Edges */}
        {edges.map(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;

          return (
            <path
              key={edge.id}
              d={`M ${source.x + 100} ${source.y + 20} C ${source.x + 150} ${source.y + 20}, ${target.x - 50} ${target.y + 20}, ${target.x} ${target.y + 20}`}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              opacity="0.6"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const colors = {
            source: 'var(--color-info)',
            combinator: 'var(--color-warning)',
            output: 'var(--color-success)',
          };

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <rect
                width="100"
                height="40"
                rx="6"
                fill={colors[node.type as keyof typeof colors] || 'var(--color-surface)'}
                opacity="0.2"
              />
              <rect
                width="100"
                height="40"
                rx="6"
                fill="none"
                stroke={colors[node.type as keyof typeof colors] || 'var(--color-border)'}
                strokeWidth="2"
              />
              <text
                x="50"
                y="25"
                textAnchor="middle"
                fill="var(--color-text-primary)"
                fontSize="11"
                fontWeight="500"
              >
                {node.label.length > 12 ? node.label.slice(0, 12) + '...' : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flow-legend">
        <div className="legend-item">
          <span className="legend-color source"></span>
          <span>Signal Source</span>
        </div>
        <div className="legend-item">
          <span className="legend-color combinator"></span>
          <span>Combinator</span>
        </div>
        <div className="legend-item">
          <span className="legend-color output"></span>
          <span>Output</span>
        </div>
      </div>

      <style>{`
        .signal-flow-canvas {
          background: var(--color-surface-elevated);
          border-radius: 8px;
          padding: 16px;
          min-height: 300px;
        }

        .signal-flow-canvas svg {
          display: block;
        }

        .flow-legend {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .legend-color.source {
          background: var(--color-info);
        }

        .legend-color.combinator {
          background: var(--color-warning);
        }

        .legend-color.output {
          background: var(--color-success);
        }
      `}</style>
    </div>
  );
};

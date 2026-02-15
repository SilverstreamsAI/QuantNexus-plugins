/**
 * TimeframeDownloadList Component
 *
 * TICKET_077_P3: Per-timeframe download status list for Alpha Factory backtest.
 * Shows checkmark/download-animation/spinner/error icons per timeframe.
 * The downloading timeframe gets a CMD-style rolling console below it
 * (8-10 lines, same pattern as PipelineProgress TICKET_328_P1).
 */

import React, { useRef, useEffect } from 'react';
import { CheckCircle, ArrowDownToLine, Loader2, XCircle } from 'lucide-react';
import { TimeframeDownloadStatus } from '../types';

interface TimeframeDownloadListProps {
  timeframeStatus: TimeframeDownloadStatus[];
}

/** Render the status icon for a given state */
const StatusIcon: React.FC<{ state: TimeframeDownloadStatus['state'] }> = ({ state }) => {
  switch (state) {
    case 'completed':
      return <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />;
    case 'downloading':
      return (
        <ArrowDownToLine
          size={16}
          className="text-emerald-400 flex-shrink-0"
          style={{ animation: 'download-bounce 1s ease-in-out infinite' }}
        />
      );
    case 'pending':
      return (
        <Loader2
          size={16}
          className="animate-spin flex-shrink-0"
          style={{ color: 'var(--color-terminal-text-muted)', opacity: 0.4 }}
        />
      );
    case 'error':
      return <XCircle size={16} className="text-red-400 flex-shrink-0" />;
    default:
      return null;
  }
};

/** CMD-style rolling console for download progress messages */
const DownloadConsole: React.FC<{ timeframe: string; lines: string[] }> = ({ timeframe, lines }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div
      className="ml-[60px] rounded border border-color-terminal-border overflow-hidden"
      style={{
        background: 'color-mix(in srgb, var(--color-terminal-surface) 95%, transparent)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Console header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1 border-b border-color-terminal-border"
        style={{ background: 'rgba(100, 255, 218, 0.04)' }}
      >
        <span className="font-mono text-[10px] text-color-terminal-accent-teal font-semibold">
          {'> '}{timeframe}
        </span>
      </div>
      {/* Console body - rolling buffer */}
      <div
        ref={scrollRef}
        className="px-3 py-1.5 max-h-[160px] overflow-y-auto"
      >
        <div className="space-y-px">
          {lines.map((line, i) => (
            <div
              key={i}
              className="font-mono text-[11px] leading-relaxed text-color-terminal-text-secondary"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TimeframeDownloadList: React.FC<TimeframeDownloadListProps> = ({ timeframeStatus }) => {
  if (timeframeStatus.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-color-terminal-border p-3 space-y-2"
      style={{ backgroundColor: 'rgba(10, 25, 47, 0.85)' }}
    >
      {timeframeStatus.map(tf => (
        <div key={tf.timeframe}>
          {/* Timeframe row: chip + icon */}
          <div className="flex items-center gap-3 h-8">
            <span
              className="w-12 text-center text-xs terminal-mono rounded px-1 py-0.5"
              style={{
                backgroundColor: 'rgba(100, 255, 218, 0.08)',
                color: 'var(--color-terminal-text-secondary)',
              }}
            >
              {tf.timeframe}
            </span>
            <StatusIcon state={tf.state} />
          </div>

          {/* CMD console below the downloading row */}
          {tf.state === 'downloading' && tf.messageBuffer && tf.messageBuffer.length > 0 && (
            <div className="mt-1 mb-2">
              <DownloadConsole timeframe={tf.timeframe} lines={tf.messageBuffer} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

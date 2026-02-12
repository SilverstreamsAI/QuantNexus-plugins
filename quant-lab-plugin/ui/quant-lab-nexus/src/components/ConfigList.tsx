/**
 * ConfigList Component
 *
 * PLUGIN_TICKET_012: Scrollable list of saved Alpha Factory configurations.
 * Follows ConversationList (TICKET_077) pattern.
 */

import React, { useCallback } from 'react';
import { FolderOpen, Trash2, Layers } from 'lucide-react';
import { ConfigSummary } from '../types';
import { SIGNAL_COMBINATOR_METHODS } from '../constants';
import { formatTimestamp } from '@shared/utils/format-locale';

function methodLabel(methodId: string): string {
  const found = SIGNAL_COMBINATOR_METHODS.find(m => m.id === methodId);
  return found ? found.name : methodId;
}

// -----------------------------------------------------------------------------
// ConfigItem
// -----------------------------------------------------------------------------

interface ConfigItemProps {
  config: ConfigSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const ConfigItem: React.FC<ConfigItemProps> = ({
  config,
  isActive,
  onSelect,
  onDelete,
}) => {
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete]
  );

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      tabIndex={0}
      className={[
        'p-3 mx-2 my-1',
        'rounded-lg',
        'cursor-pointer',
        'group',
        'border border-transparent',
        'transition-all duration-200',
        isActive
          ? 'bg-color-terminal-accent-primary text-color-terminal-bg border-color-terminal-accent-primary shadow-lg shadow-color-terminal-accent-primary/20'
          : 'hover:bg-color-terminal-surface-hover hover:border-color-terminal-border hover:translate-x-1',
      ].join(' ')}
    >
      {/* Row 1: Name + Timestamp */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={[
            'text-sm font-semibold truncate flex-1',
            isActive ? 'text-color-terminal-bg' : 'text-color-terminal-text',
          ].join(' ')}
        >
          {config.name}
        </span>
        <span
          className={[
            'text-xs ml-2 flex-shrink-0',
            isActive ? 'text-color-terminal-bg/80' : 'text-color-terminal-text-muted',
          ].join(' ')}
        >
          {formatTimestamp(config.updatedAt)}
        </span>
      </div>

      {/* Row 2: Summary */}
      <p
        className={[
          'text-xs truncate mb-1',
          isActive ? 'text-color-terminal-bg/90' : 'text-color-terminal-text-secondary',
        ].join(' ')}
      >
        {config.signalCount} signal{config.signalCount !== 1 ? 's' : ''} | {methodLabel(config.signalMethod)}
      </p>

      {/* Row 3: Meta + Delete */}
      <div className="flex items-center justify-between">
        <div
          className={[
            'flex items-center gap-1 text-xs',
            isActive ? 'text-color-terminal-bg/70' : 'text-color-terminal-text-muted',
          ].join(' ')}
        >
          <Layers className="w-3 h-3" />
          <span>{config.exitCount} rule{config.exitCount !== 1 ? 's' : ''} active</span>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className={[
            'p-1 rounded opacity-0 group-hover:opacity-100',
            'transition-all duration-200',
            isActive
              ? 'hover:bg-color-terminal-bg/20 text-color-terminal-bg/70 hover:text-color-terminal-bg'
              : 'hover:bg-red-500/10 text-color-terminal-text-muted hover:text-red-500',
          ].join(' ')}
          aria-label="Delete configuration"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// ConfigList
// -----------------------------------------------------------------------------

export interface ConfigListProps {
  configs: ConfigSummary[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
  className?: string;
}

export const ConfigList: React.FC<ConfigListProps> = ({
  configs,
  activeId,
  onSelect,
  onDelete,
  emptyText = 'No saved configurations',
  className = '',
}) => {
  if (configs.length === 0) {
    return (
      <div
        className={[
          'flex-1 flex flex-col items-center justify-center',
          'p-6 text-center',
          className,
        ].join(' ')}
      >
        <FolderOpen className="w-10 h-10 text-color-terminal-text-muted/50 mb-3" />
        <p className="text-sm text-color-terminal-text-muted">{emptyText}</p>
        <p className="text-xs text-color-terminal-text-muted/70 mt-1">
          Create a new config to begin
        </p>
      </div>
    );
  }

  return (
    <div className={['flex-1 overflow-y-auto', 'py-2', className].join(' ')}>
      {configs.map((config) => (
        <ConfigItem
          key={config.id}
          config={config}
          isActive={config.id === activeId}
          onSelect={() => onSelect(config.id)}
          onDelete={() => onDelete(config.id)}
        />
      ))}
    </div>
  );
};

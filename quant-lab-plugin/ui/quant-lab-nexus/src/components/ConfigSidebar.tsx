/**
 * ConfigSidebar Component
 *
 * PLUGIN_TICKET_012: Left sidebar for browsing/managing Alpha Factory configurations.
 * Composes NewConfigButton, ConfigSearch, and ConfigList.
 * Follows ConversationSidebar (TICKET_077) pattern.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ConfigSummary } from '../types';
import { NewConfigButton } from './NewConfigButton';
import { ConfigSearch } from './ConfigSearch';
import { ConfigList } from './ConfigList';

export interface ConfigSidebarProps {
  configs: ConfigSummary[];
  activeConfigId: string | undefined;
  onNewConfig: () => void;
  onSelectConfig: (id: string) => void;
  onDeleteConfig: (id: string) => void;
  isLoading?: boolean;
  width?: number;
  className?: string;
}

export const ConfigSidebar: React.FC<ConfigSidebarProps> = ({
  configs,
  activeConfigId,
  onNewConfig,
  onSelectConfig,
  onDeleteConfig,
  isLoading = false,
  width = 260,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
  }, []);

  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return configs;
    const query = searchQuery.toLowerCase();
    return configs.filter((c) => c.name.toLowerCase().includes(query));
  }, [configs, searchQuery]);

  return (
    <aside
      className={[
        'flex flex-col',
        'h-full overflow-hidden',
        'bg-color-terminal-surface-secondary',
        'border-r border-color-terminal-border',
        'relative',
        className,
      ].join(' ')}
      style={{ width, minWidth: width }}
    >
      <NewConfigButton
        onClick={onNewConfig}
        disabled={isLoading}
      />

      <ConfigSearch
        value={searchQuery}
        onChange={handleSearchChange}
        onClear={handleSearchClear}
        disabled={isLoading}
      />

      <ConfigList
        configs={filteredConfigs}
        activeId={activeConfigId}
        onSelect={onSelectConfig}
        onDelete={onDeleteConfig}
        emptyText={
          searchQuery
            ? 'No configs match your search'
            : 'No saved configurations'
        }
      />

      {isLoading && (
        <div className="absolute inset-0 bg-color-terminal-bg/50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-color-terminal-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </aside>
  );
};

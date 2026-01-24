/**
 * PluginSettingsPage - Plugin-level settings page
 *
 * TICKET_093: Plugin Settings UI Decoupling
 * Full settings page owned by the plugin, not Host layer.
 *
 * @see TICKET_093 - Plugin Settings Decoupling
 * @see TICKET_081 - Plugin Settings Architecture
 */

import React, { useState } from 'react';
import { Key, Sliders, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfigTab } from './ConfigTab';
import { SecretsTab } from './SecretsTab';

// =============================================================================
// Types
// =============================================================================

type SettingsTab = 'config' | 'secrets';

interface TabItem {
  id: SettingsTab;
  label: string;
  Icon: React.ElementType;
}

interface PluginSettingsPageProps {
  pluginId: string;
  pluginName: string;
  onBack?: () => void;
  /** Default tab to show when opening settings */
  defaultTab?: SettingsTab;
}

// =============================================================================
// Tab Configuration
// =============================================================================

const TABS: TabItem[] = [
  {
    id: 'config',
    label: 'Config',
    Icon: Sliders,
  },
  {
    id: 'secrets',
    label: 'Secrets',
    Icon: Key,
  },
];

// =============================================================================
// TabButton Component (Segmented control style)
// =============================================================================

interface TabButtonProps {
  label: string;
  Icon: React.ElementType;
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  Icon,
  active,
  isFirst,
  isLast,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-1.5 transition-all duration-200",
        active
          ? "bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal"
          : "bg-transparent text-color-terminal-text-muted hover:text-color-terminal-accent-teal hover:bg-white/5",
        isFirst && "rounded-l",
        isLast && "rounded-r",
        !isLast && "border-r border-dashed border-white/20"
      )}
    >
      <Icon className="w-3 h-3" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
};

// =============================================================================
// MiniNameplate Component
// =============================================================================

interface MiniNameplateProps {
  text: string;
}

const MiniNameplate: React.FC<MiniNameplateProps> = ({ text }) => {
  return (
    <div className="inline-flex items-center px-3 py-1 border border-dashed border-white/30 rounded">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-color-terminal-text-muted">
        {text}
      </span>
    </div>
  );
};

// =============================================================================
// Header Bar Component
// =============================================================================

interface SettingsHeaderBarProps {
  pluginName: string;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onBack?: () => void;
}

const SettingsHeaderBar: React.FC<SettingsHeaderBarProps> = ({
  pluginName,
  activeTab,
  onTabChange,
  onBack,
}) => {
  const nameplateText = pluginName.toUpperCase();

  return (
    <div className="h-8 border-b border-color-terminal-border bg-color-terminal-panel flex items-center justify-between px-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      {/* Left: Back button + Plugin name */}
      <div className="flex items-center gap-3">
        {onBack && (
          <>
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-color-terminal-text-muted hover:text-color-terminal-accent-teal transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Back</span>
            </button>
            <div className="h-4 w-px bg-white/20" />
          </>
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-color-terminal-text-muted">
          Config
        </span>
      </div>

      {/* Center: Nameplate */}
      <div className="flex-1 flex items-center justify-center">
        <MiniNameplate text={nameplateText} />
      </div>

      {/* Right: Tab switcher */}
      <div className="inline-flex border border-dashed border-white/20 rounded">
        {TABS.map((tab, index) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            Icon={tab.Icon}
            active={activeTab === tab.id}
            isFirst={index === 0}
            isLast={index === TABS.length - 1}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export function PluginSettingsPage({
  pluginId,
  pluginName,
  onBack,
  defaultTab = 'config',
}: PluginSettingsPageProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  return (
    <div className="h-full flex flex-col bg-silverstream terminal-theme">
      {/* Header Bar */}
      <SettingsHeaderBar
        pluginName={pluginName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={onBack}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'config' ? (
          <ConfigTab pluginId={pluginId} />
        ) : (
          <SecretsTab pluginId={pluginId} />
        )}
      </div>
    </div>
  );
}

export default PluginSettingsPage;
export type { PluginSettingsPageProps, SettingsTab };

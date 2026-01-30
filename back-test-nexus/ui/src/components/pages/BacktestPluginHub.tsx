/**
 * BacktestPluginHub Component (page21)
 *
 * Plugin hub interface showing available cockpit modes.
 * Similar to page2 (StrategyPluginHub).
 *
 * @see TICKET_209 - Backtest Plugin Hub Navigation
 * @see TICKET_077_1 - Page Hierarchy
 */

import React from 'react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Inline SVG Icons (no external dependency)
// -----------------------------------------------------------------------------

const BarChart3Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const TrendingUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const CpuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2" />
    <path d="M15 20v2" />
    <path d="M2 15h2" />
    <path d="M2 9h2" />
    <path d="M20 15h2" />
    <path d="M20 9h2" />
    <path d="M9 2v2" />
    <path d="M9 20v2" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CockpitTier = 'free' | 'pro';

interface CockpitConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  tier: CockpitTier;
}

// TICKET_211: Runtime item with computed locked state
interface CockpitItem extends CockpitConfig {
  locked: boolean;
}

export interface BacktestPluginHubProps {
  /** Callback when a cockpit is selected */
  onSelectCockpit: (cockpitId: string) => void;
  /** Callback when a locked cockpit is clicked */
  onLockedClick?: (cockpit: CockpitItem) => void;
  /** TICKET_211: User has PRO/GOLD plan (from host via useHasPlan) */
  userHasPro?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * TICKET_211: Cockpit configurations without hardcoded locked state.
 * locked is computed dynamically based on userHasPro prop.
 */
const COCKPIT_CONFIGS: CockpitConfig[] = [
  {
    id: 'indicators',
    name: 'INDICATORS COCKPIT',
    description: 'Indicator-based backtest with workflow configuration',
    icon: BarChart3Icon,
    tier: 'free',
  },
  {
    id: 'trader',
    name: 'TRADER COCKPIT',
    description: 'Watchlist + LLM Trader backtest strategies',
    icon: TrendingUpIcon,
    tier: 'pro',
  },
  {
    id: 'ai',
    name: 'AI COCKPIT',
    description: 'AI-powered backtest analysis',
    icon: CpuIcon,
    tier: 'pro',
  },
  {
    id: 'kronos',
    name: 'KRONOS COCKPIT',
    description: 'Kronos time-series backtest integration',
    icon: ClockIcon,
    tier: 'pro',
  },
];

const TIER_COLORS: Record<CockpitTier, string> = {
  free: 'bg-green-500/20 text-green-400 border-green-500/30',
  pro: 'bg-color-terminal-accent-gold/20 text-color-terminal-accent-gold border-color-terminal-accent-gold/30',
};

// -----------------------------------------------------------------------------
// Sub-component: CockpitCard
// -----------------------------------------------------------------------------

interface CockpitCardProps {
  cockpit: CockpitItem;
  onClick: () => void;
}

const CockpitCard: React.FC<CockpitCardProps> = ({ cockpit, onClick }) => {
  const Icon = cockpit.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col p-6 rounded-lg border transition-all duration-300',
        'bg-color-terminal-panel/30 backdrop-blur-md',
        cockpit.locked
          ? 'border-white/10 opacity-60 cursor-not-allowed'
          : 'border-color-terminal-border hover:border-color-terminal-accent-teal/50 cursor-pointer hover:bg-color-terminal-accent-teal/5'
      )}
    >
      {/* Glow effect on hover (unlocked only) */}
      {!cockpit.locked && (
        <div className="absolute inset-0 bg-color-terminal-accent-teal/10 blur-xl rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}

      {/* Header: Icon + Badges */}
      <div className="relative flex items-start justify-between mb-4">
        <div
          className={cn(
            'p-3 rounded-lg border transition-all duration-300',
            cockpit.locked
              ? 'border-white/10 bg-white/5 text-color-terminal-text-muted'
              : 'border-color-terminal-accent-teal/30 bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal group-hover:shadow-glow-teal'
          )}
        >
          <Icon className="w-6 h-6" />
        </div>

        <div className="flex items-center gap-2">
          {/* Tier Badge */}
          <span
            className={cn(
              'text-[9px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold',
              TIER_COLORS[cockpit.tier]
            )}
          >
            {cockpit.tier}
          </span>

          {/* Lock Icon */}
          {cockpit.locked && (
            <LockIcon className="w-4 h-4 text-color-terminal-text-muted" />
          )}
        </div>
      </div>

      {/* Title */}
      <h3
        className={cn(
          'text-sm font-black terminal-mono uppercase tracking-[0.15em] mb-2 transition-colors',
          cockpit.locked
            ? 'text-color-terminal-text-muted'
            : 'text-white group-hover:text-color-terminal-accent-teal'
        )}
      >
        {cockpit.name}
      </h3>

      {/* Description */}
      <p className="text-[11px] text-color-terminal-text-secondary leading-relaxed">
        {cockpit.description}
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const BacktestPluginHub: React.FC<BacktestPluginHubProps> = ({
  onSelectCockpit,
  onLockedClick,
  userHasPro = false,
}) => {
  // TICKET_211: Compute locked state dynamically based on user tier
  // PRO cockpits are locked if user does not have PRO/GOLD plan
  const cockpitItems: CockpitItem[] = COCKPIT_CONFIGS.map((config) => ({
    ...config,
    locked: config.tier === 'pro' && !userHasPro,
  }));

  const handleCardClick = (cockpit: CockpitItem) => {
    if (cockpit.locked) {
      onLockedClick?.(cockpit);
    } else {
      onSelectCockpit(cockpit.id);
    }
  };

  return (
    <div className="h-full flex flex-col terminal-theme bg-silverstream relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-color-terminal-accent-teal/5 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-color-terminal-accent-gold/5 blur-[80px] pointer-events-none rounded-full" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-10 z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-lg font-black terminal-mono uppercase tracking-[0.2em] text-white mb-2">
              SELECT COCKPIT
            </h1>
            <p className="text-xs text-color-terminal-text-muted">
              Choose a backtest mode to continue
            </p>
          </div>

          {/* Cockpit Grid (2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cockpitItems.map((cockpit) => (
              <CockpitCard
                key={cockpit.id}
                cockpit={cockpit}
                onClick={() => handleCardClick(cockpit)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BacktestPluginHub;

/**
 * Strategy Plugin Views
 *
 * This module re-exports the view components that will be rendered by the Host.
 * For now, these components are located in the desktop app's features folder.
 * They will be moved here as part of the full plugin extraction.
 *
 * @see TICKET_059 - Host/Plugin Architecture
 */

// Component paths (relative to desktop app)
// These will be used to dynamically import components in the Host
export const VIEW_COMPONENTS = {
  'strategy.hub': '@renderer/features/strategy/components/hub/StrategyHub',
  'strategy.providerPortal': '@renderer/features/strategy/components/hub/ProviderPortal',
  'strategy.groupList': '@renderer/features/strategy/components/hub/StrategyGroupList',
  'strategy.regimeEditor': '@renderer/features/strategy/components/regime/RegimeEditor',
} as const;

export type ViewComponentId = keyof typeof VIEW_COMPONENTS;

/**
 * StrategyHubProvider - View provider for the Strategy Hub (Level 1)
 *
 * This provider returns the StrategyHub React component for the Host to render.
 *
 * @see TICKET_059 - Host/Plugin Architecture
 */

import type { ViewProvider, ViewOptions, ViewElement } from '@shared/types';

// Import the actual component (will be bundled with plugin)
// For now, using dynamic import pattern
let StrategyHubComponent: React.ComponentType | null = null;

export class StrategyHubProvider implements ViewProvider {
  private isVisible = false;

  /**
   * Resolve view element for the Hub
   */
  resolveView(_viewId: string, _options?: ViewOptions): ViewElement {
    // Return React component type
    return {
      type: 'react',
      content: StrategyHubComponent || this.getFallbackComponent(),
      props: {},
    };
  }

  /**
   * Called when view becomes visible
   */
  onDidShow(): void {
    this.isVisible = true;
    console.debug('[StrategyHubProvider] View shown');
  }

  /**
   * Called when view becomes hidden
   */
  onDidHide(): void {
    this.isVisible = false;
    console.debug('[StrategyHubProvider] View hidden');
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.isVisible = false;
    console.debug('[StrategyHubProvider] Disposed');
  }

  /**
   * Set the component (called during plugin initialization)
   */
  static setComponent(component: React.ComponentType): void {
    StrategyHubComponent = component;
  }

  /**
   * Fallback component when main component not loaded
   */
  private getFallbackComponent(): React.ComponentType {
    return function StrategyHubFallback() {
      return null; // Placeholder
    };
  }
}

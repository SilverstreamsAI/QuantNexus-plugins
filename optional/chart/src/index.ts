/**
 * Chart Plugin Entry Point
 *
 * 这是插件的主入口，定义了 activate/deactivate 生命周期
 */

import type { PluginContext, PluginApi } from './types';

// 插件 API 实现
class ChartPluginApi implements PluginApi {
  private context: PluginContext;
  private zoomLevel = 1;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async activate(): Promise<void> {
    this.context.log.info('Chart plugin activated');

    // 注册命令
    this.context.commands.register('zoomIn', () => this.zoomIn());
    this.context.commands.register('zoomOut', () => this.zoomOut());
    this.context.commands.register('reset', () => this.reset());
    this.context.commands.register('addIndicator', (indicator: unknown) => this.addIndicator(String(indicator)));

    // 恢复状态
    const savedZoom = await this.context.storage.get<number>('zoomLevel');
    if (savedZoom) {
      this.zoomLevel = savedZoom;
    }
  }

  async deactivate(): Promise<void> {
    // 保存状态
    await this.context.storage.set('zoomLevel', this.zoomLevel);
    this.context.log.info('Chart plugin deactivated');
  }

  getConfig(): Record<string, unknown> {
    return {
      zoomLevel: this.zoomLevel,
    };
  }

  setConfig(config: Record<string, unknown>): void {
    if (typeof config.zoomLevel === 'number') {
      this.zoomLevel = config.zoomLevel;
    }
  }

  // Chart commands
  private zoomIn(): void {
    this.zoomLevel = Math.min(this.zoomLevel * 1.2, 10);
    this.context.state.set('zoomLevel', this.zoomLevel);
    this.context.log.debug(`Zoom in: ${this.zoomLevel}`);
  }

  private zoomOut(): void {
    this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.1);
    this.context.state.set('zoomLevel', this.zoomLevel);
    this.context.log.debug(`Zoom out: ${this.zoomLevel}`);
  }

  private reset(): void {
    this.zoomLevel = 1;
    this.context.state.set('zoomLevel', this.zoomLevel);
    this.context.log.debug('Zoom reset');
  }

  private addIndicator(indicator: string): void {
    this.context.log.info(`Adding indicator: ${indicator}`);
    this.context.ui.showNotification(`Indicator added: ${indicator}`, 'success');
  }
}

// 模块导出
export async function activate(context: PluginContext): Promise<PluginApi> {
  const api = new ChartPluginApi(context);
  await api.activate();
  return api;
}

export async function deactivate(): Promise<void> {
  // Cleanup if needed
}

export default { activate, deactivate };

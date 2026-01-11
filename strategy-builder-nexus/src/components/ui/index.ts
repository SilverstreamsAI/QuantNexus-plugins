/**
 * Strategy Plugin UI Components
 *
 * Silverstream-styled UI components for Strategy Studio.
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_078 - Input Theming and Portal Patterns
 */

export { ExpressionInput } from './ExpressionInput';
export type { ExpressionInputProps } from './ExpressionInput';

export { StrategyCard } from './StrategyCard';
export type { StrategyCardProps } from './StrategyCard';

export { RegimeSelector } from './RegimeSelector';
export type { RegimeSelectorProps, RegimeOption, BespokeData } from './RegimeSelector';

export { IndicatorSelector } from './IndicatorSelector';
export type { IndicatorSelectorProps, IndicatorBlock, IndicatorDefinition, IndicatorParam, StrategyTemplate } from './IndicatorSelector';

export { DirectionalIndicatorSelector } from './DirectionalIndicatorSelector';
export type { DirectionalIndicatorSelectorProps, DirectionalIndicatorBlock, TradeDirection } from './DirectionalIndicatorSelector';

export { PortalDropdown } from './PortalDropdown';
export type { PortalDropdownProps } from './PortalDropdown';

export { ValidateInputBeforeGenerate, useValidateBeforeGenerate } from './ValidateInputBeforeGenerate';
export type { ValidateInputBeforeGenerateProps, ValidationConfig, UseValidateBeforeGenerateOptions } from './ValidateInputBeforeGenerate';

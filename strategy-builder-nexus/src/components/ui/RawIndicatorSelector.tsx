/**
 * RawIndicatorSelector Component (component20)
 *
 * Card-based raw indicator selector for adding technical indicators.
 * Simplified version of IndicatorSelector (component3) without template/rule logic.
 * Used for raw indicator input in LLM-powered strategy generation.
 *
 * @see TICKET_077_19 - Kronos AI Entry Components
 * @see TICKET_211 - Page 34 - Kronos AI Entry
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PortalDropdown } from './PortalDropdown';
import type { IndicatorDefinition, IndicatorParam } from './IndicatorSelector';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RawIndicatorBlock {
  id: string;
  indicatorSlug: string | null;
  paramValues: Record<string, number | string>;
}

export interface RawIndicatorSelectorProps {
  /** Component title */
  title?: string;
  /** Available indicators (from JSON) */
  indicators: IndicatorDefinition[];
  /** Current indicator blocks state */
  blocks: RawIndicatorBlock[];
  /** Callback when blocks change */
  onChange: (blocks: RawIndicatorBlock[]) => void;
  /** Add button label */
  addButtonLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'INDICATOR CONFIGURATION';
const DEFAULT_ADD_LABEL = '+ Add Indicator';

// Generate unique ID
const generateId = (): string => `ind_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// -----------------------------------------------------------------------------
// Section Title Component
// -----------------------------------------------------------------------------

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-bold uppercase tracking-wider text-color-terminal-accent-teal mb-3">
    {children}
  </h3>
);

// -----------------------------------------------------------------------------
// RawIndicatorBlockItem Component
// -----------------------------------------------------------------------------

interface RawIndicatorBlockItemProps {
  block: RawIndicatorBlock;
  indicators: IndicatorDefinition[];
  onUpdate: (block: RawIndicatorBlock) => void;
  onDelete: (id: string) => void;
}

const RawIndicatorBlockItem: React.FC<RawIndicatorBlockItemProps> = ({
  block,
  indicators,
  onUpdate,
  onDelete,
}) => {
  const [isIndicatorOpen, setIsIndicatorOpen] = useState(false);
  const indicatorTriggerRef = useRef<HTMLButtonElement>(null);

  // Filter to only show usable indicators
  const availableIndicators = useMemo(() => {
    return indicators.filter(ind => !ind.internal_use_only);
  }, [indicators]);

  // Get selected indicator definition
  const selectedIndicator = useMemo(() => {
    return indicators.find(ind => ind.slug === block.indicatorSlug);
  }, [indicators, block.indicatorSlug]);

  // Handle indicator selection
  const handleSelectIndicator = useCallback((slug: string) => {
    const indicator = indicators.find(ind => ind.slug === slug);
    if (indicator) {
      const defaultParams: Record<string, number | string> = {};
      indicator.params.forEach(param => {
        defaultParams[param.name] = param.default;
      });

      onUpdate({
        ...block,
        indicatorSlug: slug,
        paramValues: defaultParams,
      });
    }
    setIsIndicatorOpen(false);
  }, [indicators, block, onUpdate]);

  // Handle parameter change
  const handleParamChange = useCallback((paramName: string, value: number | string) => {
    onUpdate({
      ...block,
      paramValues: {
        ...block.paramValues,
        [paramName]: value,
      },
    });
  }, [block, onUpdate]);

  return (
    <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface/30">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-color-terminal-surface/50 border-b border-color-terminal-border">
        <span className="text-sm font-bold text-color-terminal-text">
          {selectedIndicator?.name || 'New Indicator'}
        </span>
        <button
          onClick={() => onDelete(block.id)}
          className="p-1 text-color-terminal-text-muted hover:text-red-500 transition-colors"
          title="Delete indicator"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Indicator Type Dropdown */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
            Indicator Type
          </label>
          <button
            ref={indicatorTriggerRef}
            onClick={() => setIsIndicatorOpen(!isIndicatorOpen)}
            className={cn(
              'w-full flex items-center justify-between',
              'px-4 py-3 text-xs terminal-mono',
              'bg-color-terminal-surface border rounded',
              'text-left',
              'focus:outline-none',
              isIndicatorOpen
                ? 'border-color-terminal-accent-gold'
                : 'border-color-terminal-border',
              selectedIndicator ? 'text-color-terminal-text' : 'text-color-terminal-text-muted'
            )}
          >
            <span>
              {selectedIndicator
                ? `${selectedIndicator.name} (${selectedIndicator.slug})`
                : 'Select an indicator...'}
            </span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', isIndicatorOpen && 'rotate-180')} />
          </button>

          <PortalDropdown
            isOpen={isIndicatorOpen}
            triggerRef={indicatorTriggerRef}
            onClose={() => setIsIndicatorOpen(false)}
          >
            {availableIndicators.map((indicator) => (
              <button
                key={indicator.slug}
                onClick={() => handleSelectIndicator(indicator.slug)}
                className={cn(
                  'w-full px-4 py-2 text-xs text-left terminal-mono',
                  'hover:bg-color-terminal-accent-gold/10',
                  'transition-colors',
                  block.indicatorSlug === indicator.slug
                    ? 'text-color-terminal-accent-gold bg-color-terminal-accent-gold/5'
                    : 'text-color-terminal-text'
                )}
              >
                {indicator.name}
                <span className="ml-2 text-color-terminal-text-muted">({indicator.slug})</span>
              </button>
            ))}
          </PortalDropdown>
        </div>

        {/* PARAMETERS Section */}
        {selectedIndicator && selectedIndicator.params.length > 0 && (
          <div className="space-y-3">
            <SectionTitle>Parameters</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {selectedIndicator.params.map((param) => (
                <div key={param.name} className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-color-terminal-text-secondary">
                    {param.label}
                  </label>
                  {param.type === 'select' && param.options ? (
                    <select
                      value={block.paramValues[param.name] ?? param.default}
                      onChange={(e) => handleParamChange(param.name, e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-xs terminal-mono',
                        'border rounded',
                        'bg-color-terminal-bg',
                        'border-color-terminal-border',
                        'text-color-terminal-text',
                        'focus:outline-none focus:border-color-terminal-accent-teal'
                      )}
                    >
                      {param.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={param.type === 'number' ? 'number' : 'text'}
                      value={block.paramValues[param.name] ?? param.default}
                      onChange={(e) => {
                        const value = param.type === 'number'
                          ? parseFloat(e.target.value) || 0
                          : e.target.value;
                        handleParamChange(param.name, value);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-xs terminal-mono',
                        'border rounded',
                        'bg-color-terminal-bg',
                        'border-color-terminal-border',
                        'text-color-terminal-text',
                        'focus:outline-none focus:border-color-terminal-accent-teal'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// RawIndicatorSelector Component
// -----------------------------------------------------------------------------

export const RawIndicatorSelector: React.FC<RawIndicatorSelectorProps> = ({
  title = DEFAULT_TITLE,
  indicators,
  blocks,
  onChange,
  addButtonLabel = DEFAULT_ADD_LABEL,
  className,
}) => {
  // Add new indicator block
  const handleAddBlock = useCallback(() => {
    const newBlock: RawIndicatorBlock = {
      id: generateId(),
      indicatorSlug: null,
      paramValues: {},
    };
    onChange([...blocks, newBlock]);
  }, [blocks, onChange]);

  // Update a block
  const handleUpdateBlock = useCallback((updatedBlock: RawIndicatorBlock) => {
    onChange(blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b));
  }, [blocks, onChange]);

  // Delete a block
  const handleDeleteBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  }, [blocks, onChange]);

  return (
    <div className={cn('raw-indicator-selector', className)}>
      {/* Title */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {title}
      </h2>

      {/* Indicator Blocks */}
      <div className="space-y-4">
        {blocks.map((block) => (
          <RawIndicatorBlockItem
            key={block.id}
            block={block}
            indicators={indicators}
            onUpdate={handleUpdateBlock}
            onDelete={handleDeleteBlock}
          />
        ))}

        {/* Add Indicator Button */}
        <button
          onClick={handleAddBlock}
          className={cn(
            'w-full py-4',
            'border-2 border-dashed border-color-terminal-border rounded-lg',
            'text-color-terminal-text-muted',
            'hover:border-color-terminal-accent-teal hover:text-color-terminal-accent-teal',
            'transition-colors duration-200',
            'flex items-center justify-center gap-2'
          )}
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium">{addButtonLabel}</span>
        </button>
      </div>
    </div>
  );
};

export default RawIndicatorSelector;

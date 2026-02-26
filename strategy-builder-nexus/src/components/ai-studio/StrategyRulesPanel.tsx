/**
 * StrategyRulesPanel Component (component19J)
 *
 * Right sidebar panel for managing strategy rules (the "spine" of the conversation).
 *
 * @see TICKET_077_19_AI_STRATEGY_STUDIO_COMPONENTS.md - Component specification
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  List,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Filter,
  Shield,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RuleType = 'entry' | 'exit' | 'filter' | 'risk';

export interface StrategyRule {
  /** Unique identifier */
  id: string;
  /** Rule type */
  type: RuleType;
  /** Rule condition/expression */
  condition: string;
  /** Optional description */
  description?: string;
  /** Rule enabled state */
  enabled?: boolean;
}

export interface StrategyRulesPanelProps {
  /** List of strategy rules */
  rules: StrategyRule[];
  /** Add rule handler */
  onAddRule?: (type: RuleType) => void;
  /** Edit rule handler */
  onEditRule?: (id: string, rule: Partial<StrategyRule>) => void;
  /** Delete rule handler */
  onDeleteRule?: (id: string) => void;
  /** Reorder rules handler */
  onReorderRules?: (rules: StrategyRule[]) => void;
  /** Toggle rule enabled state */
  onToggleRule?: (id: string) => void;
  /** Panel width */
  width?: number;
  /** Read-only mode */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const RULE_CONFIG: Record<RuleType, {
  icon: React.FC<{ className?: string }>;
  labelKey: string;
  color: string;
  bgColor: string;
}> = {
  entry: {
    icon: TrendingUp,
    labelKey: 'aiStudio.ruleTypeEntry',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  exit: {
    icon: TrendingDown,
    labelKey: 'aiStudio.ruleTypeExit',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  filter: {
    icon: Filter,
    labelKey: 'aiStudio.ruleTypeFilter',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  risk: {
    icon: Shield,
    labelKey: 'aiStudio.ruleTypeRisk',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
};

// -----------------------------------------------------------------------------
// Rule Item Sub-component
// -----------------------------------------------------------------------------

interface RuleItemProps {
  rule: StrategyRule;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  readOnly?: boolean;
}

const RuleItem: React.FC<RuleItemProps> = ({
  rule,
  onEdit,
  onDelete,
  onToggle,
  readOnly = false,
}) => {
  const { t } = useTranslation('strategy-builder');
  const [isExpanded, setIsExpanded] = useState(false);
  const config = RULE_CONFIG[rule.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'group',
        'border border-color-terminal-border rounded-lg',
        'bg-color-terminal-surface',
        'transition-all duration-200',
        'hover:border-color-terminal-border-hover',
        rule.enabled === false && 'opacity-50'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-2 p-3',
          'cursor-pointer'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Drag Handle */}
        {!readOnly && (
          <GripVertical
            className={cn(
              'w-4 h-4 flex-shrink-0',
              'text-color-terminal-text-muted/50',
              'opacity-0 group-hover:opacity-100',
              'cursor-grab active:cursor-grabbing',
              'transition-opacity duration-200'
            )}
          />
        )}

        {/* Type Badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded',
            config.bgColor
          )}
        >
          <Icon className={cn('w-3.5 h-3.5', config.color)} />
          <span className={cn('text-[10px] font-bold uppercase', config.color)}>
            {t(config.labelKey)}
          </span>
        </div>

        {/* Condition Preview */}
        <span className="flex-1 text-xs text-color-terminal-text truncate">
          {rule.condition}
        </span>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1 text-color-terminal-text-muted hover:text-color-terminal-text"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-color-terminal-border/50">
          {/* Description */}
          {rule.description && (
            <p className="text-xs text-color-terminal-text-muted mt-2 mb-3">
              {rule.description}
            </p>
          )}

          {/* Full Condition */}
          <div className="bg-color-terminal-bg/50 rounded p-2 mb-3">
            <code className="text-xs font-mono text-color-terminal-text break-all">
              {rule.condition}
            </code>
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.enabled !== false}
                  onChange={onToggle}
                  className="w-3.5 h-3.5 rounded border-color-terminal-border"
                />
                <span className="text-[10px] text-color-terminal-text-muted">
                  {t('aiStudio.enabled')}
                </span>
              </label>

              <button
                type="button"
                onClick={onDelete}
                className={cn(
                  'p-1.5 rounded',
                  'text-color-terminal-text-muted',
                  'hover:bg-red-500/10 hover:text-red-500',
                  'transition-colors duration-200'
                )}
                aria-label={t('aiStudio.deleteRule')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Add Rule Menu Sub-component
// -----------------------------------------------------------------------------

interface AddRuleMenuProps {
  onAdd: (type: RuleType) => void;
}

const AddRuleMenu: React.FC<AddRuleMenuProps> = ({ onAdd }) => {
  const { t } = useTranslation('strategy-builder');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-center gap-2',
          'px-4 py-2.5',
          'border border-dashed border-color-terminal-border',
          'rounded-lg',
          'text-xs font-medium text-color-terminal-text-muted',
          'transition-all duration-200',
          'hover:border-color-terminal-accent-primary',
          'hover:text-color-terminal-accent-primary',
          'hover:bg-color-terminal-accent-primary/5'
        )}
      >
        <Plus className="w-4 h-4" />
        <span>{t('aiStudio.addRule')}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            className={cn(
              'absolute top-full left-0 right-0 mt-1 z-20',
              'bg-color-terminal-surface',
              'border border-color-terminal-border',
              'rounded-lg shadow-xl',
              'overflow-hidden',
              'animate-in fade-in slide-in-from-top-2 duration-200'
            )}
          >
            {(Object.keys(RULE_CONFIG) as RuleType[]).map((type) => {
              const config = RULE_CONFIG[type];
              const Icon = config.icon;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onAdd(type);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3',
                    'text-left',
                    'hover:bg-color-terminal-surface-hover',
                    'transition-colors duration-150'
                  )}
                >
                  <div className={cn('p-1.5 rounded', config.bgColor)}>
                    <Icon className={cn('w-4 h-4', config.color)} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-color-terminal-text">
                      {t('aiStudio.ruleLabel', { label: t(config.labelKey) })}
                    </div>
                    <div className="text-[10px] text-color-terminal-text-muted">
                      {t('aiStudio.addCondition', { label: t(config.labelKey).toLowerCase() })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const StrategyRulesPanel: React.FC<StrategyRulesPanelProps> = ({
  rules,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onReorderRules,
  onToggleRule,
  width = 360,
  readOnly = false,
  className,
}) => {
  const { t } = useTranslation('strategy-builder');
  // Group rules by type
  const groupedRules = React.useMemo(() => {
    const groups: Record<RuleType, StrategyRule[]> = {
      entry: [],
      exit: [],
      filter: [],
      risk: [],
    };

    rules.forEach((rule) => {
      groups[rule.type].push(rule);
    });

    return groups;
  }, [rules]);

  const totalRules = rules.length;

  return (
    <aside
      className={cn(
        // Layout
        'flex flex-col h-full overflow-hidden',
        // Appearance
        'bg-color-terminal-surface-secondary',
        'border-l border-color-terminal-border',
        className
      )}
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-color-terminal-border">
        <List className="w-5 h-5 text-color-terminal-accent-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-color-terminal-text">
          {t('aiStudio.strategyRules')}
        </h3>
        {totalRules > 0 && (
          <span className="ml-auto text-xs font-mono text-color-terminal-text-muted">
            {totalRules}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Empty State */}
        {totalRules === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <List className="w-12 h-12 text-color-terminal-text-muted/30 mb-3" />
            <p className="text-sm text-color-terminal-text-muted mb-1">
              {t('aiStudio.noRulesDefined')}
            </p>
            <p className="text-xs text-color-terminal-text-muted/70">
              {t('aiStudio.addRulesToBuild')}
            </p>
          </div>
        )}

        {/* Rules List */}
        {rules.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            onEdit={() => onEditRule?.(rule.id, rule)}
            onDelete={() => onDeleteRule?.(rule.id)}
            onToggle={() => onToggleRule?.(rule.id)}
            readOnly={readOnly}
          />
        ))}

        {/* Add Rule Button */}
        {!readOnly && onAddRule && (
          <div className="pt-2">
            <AddRuleMenu onAdd={onAddRule} />
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {totalRules > 0 && (
        <div className="px-4 py-3 border-t border-color-terminal-border bg-color-terminal-surface/50">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RULE_CONFIG) as RuleType[]).map((type) => {
              const count = groupedRules[type].length;
              if (count === 0) return null;

              const config = RULE_CONFIG[type];
              return (
                <span
                  key={type}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium',
                    config.bgColor,
                    config.color
                  )}
                >
                  {count} {t(config.labelKey)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default StrategyRulesPanel;

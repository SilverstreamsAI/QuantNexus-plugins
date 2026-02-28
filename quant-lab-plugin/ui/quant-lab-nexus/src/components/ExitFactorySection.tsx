/**
 * ExitFactorySection Component
 *
 * TICKET_275: Rewritten from card grid to built-in risk override panel.
 * TICKET_422_6: Internationalized with i18n translations
 * 5x RiskRuleRow (toggle + inline parameters) + Hard Safety + Combinator.
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  Zap,
  TrendingDown,
  Clock,
  Activity,
  GitBranch,
} from 'lucide-react';
import { ExitRules } from '../types';
import {
  EXIT_COMBINATOR_METHODS,
  RISK_RULE_META,
  RULE_ACTIONS,
  REGIME_INDICATORS,
  TIME_UNITS,
} from '../constants';
import { RiskRuleRow, HardSafetyRow } from './RiskRuleRow';

// -----------------------------------------------------------------------------
// Icon map (lucide-react icons by name)
// -----------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-4 h-4" />,
  TrendingDown: <TrendingDown className="w-4 h-4" />,
  Clock: <Clock className="w-4 h-4" />,
  Activity: <Activity className="w-4 h-4" />,
  GitBranch: <GitBranch className="w-4 h-4" />,
};

// -----------------------------------------------------------------------------
// Shared inline input components
// -----------------------------------------------------------------------------

const ParamLabel: React.FC<{ text: string }> = ({ text }) => (
  <span className="text-xs text-color-terminal-text-secondary">{text}</span>
);

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  width?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value, onChange, min, max, step = 1, unit, width = 'w-20',
}) => (
  <div className="flex items-center gap-1">
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className={`${width} px-2 py-1 rounded bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-xs text-right focus:outline-none focus:border-color-terminal-accent-primary`}
    />
    {unit && <span className="text-xs text-color-terminal-text-secondary">{unit}</span>}
  </div>
);

interface SelectInputProps {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (v: string) => void;
}

const SelectInput: React.FC<SelectInputProps> = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="px-2 py-1 rounded bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-xs focus:outline-none focus:border-color-terminal-accent-primary"
  >
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ExitFactorySectionProps {
  exitRules: ExitRules;
  exitMethod: string;
  onExitRulesChange: (rules: ExitRules) => void;
  onMethodChange: (method: string) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const ExitFactorySection: React.FC<ExitFactorySectionProps> = ({
  exitRules,
  exitMethod,
  onExitRulesChange,
  onMethodChange,
}) => {
  const { t } = useTranslation('quant-lab');

  // Helper: shallow-merge a single rule key
  const updateRule = useCallback(
    <K extends keyof ExitRules>(key: K, patch: Partial<ExitRules[K]>) => {
      onExitRulesChange({
        ...exitRules,
        [key]: { ...exitRules[key], ...patch },
      });
    },
    [exitRules, onExitRulesChange],
  );

  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-color-terminal-accent-teal" />
        {t('exitFactory.title')}
      </h2>

      <div className="space-y-3 mb-4">
        {/* 5x Risk Rule Rows */}
        {RISK_RULE_META.map(meta => {
          const rule = exitRules[meta.key];
          const enabled = 'enabled' in rule ? rule.enabled : false;

          return (
            <RiskRuleRow
              key={meta.key}
              label={meta.label}
              icon={ICON_MAP[meta.icon]}
              color={meta.color}
              priority={meta.priority}
              enabled={enabled}
              onToggle={v => updateRule(meta.key, { enabled: v } as Partial<ExitRules[typeof meta.key]>)}
            >
              {/* Circuit Breaker params (P1) */}
              {meta.key === 'circuitBreaker' && (
                <>
                  <ParamLabel text="PnL <" />
                  <NumberInput
                    value={exitRules.circuitBreaker.triggerPnl}
                    onChange={v => updateRule('circuitBreaker', { triggerPnl: v })}
                    min={-50} max={0} step={0.5} unit="%"
                  />
                  <ParamLabel text="Cooldown" />
                  <NumberInput
                    value={exitRules.circuitBreaker.cooldownBars}
                    onChange={v => updateRule('circuitBreaker', { cooldownBars: v })}
                    min={0} max={100} step={1} unit="bars"
                  />
                  <ParamLabel text="Action" />
                  <SelectInput
                    value={exitRules.circuitBreaker.action}
                    options={RULE_ACTIONS.circuitBreaker}
                    onChange={v => updateRule('circuitBreaker', { action: v as 'close_all' | 'reduce_to' })}
                  />
                  {exitRules.circuitBreaker.action === 'reduce_to' && (
                    <NumberInput
                      value={exitRules.circuitBreaker.reduceToPercent ?? 50}
                      onChange={v => updateRule('circuitBreaker', { reduceToPercent: v })}
                      min={1} max={99} step={1} unit="%"
                    />
                  )}
                </>
              )}

              {/* Time Limit params (P2) */}
              {meta.key === 'timeLimit' && (
                <>
                  <ParamLabel text="Max Holding" />
                  <NumberInput
                    value={exitRules.timeLimit.maxHolding}
                    onChange={v => updateRule('timeLimit', { maxHolding: v })}
                    min={1} max={9999} step={1}
                  />
                  <SelectInput
                    value={exitRules.timeLimit.unit}
                    options={TIME_UNITS}
                    onChange={v => updateRule('timeLimit', { unit: v as 'hours' | 'bars' })}
                  />
                  <ParamLabel text="Action" />
                  <SelectInput
                    value={exitRules.timeLimit.action}
                    options={RULE_ACTIONS.timeLimit}
                    onChange={v => updateRule('timeLimit', { action: v as 'close_all' | 'reduce_to' })}
                  />
                </>
              )}

              {/* Regime Detection params (P3) */}
              {meta.key === 'regimeDetection' && (
                <>
                  <SelectInput
                    value={exitRules.regimeDetection.indicator}
                    options={REGIME_INDICATORS}
                    onChange={v => updateRule('regimeDetection', { indicator: v as 'ATR' | 'VIX' | 'RealizedVol' })}
                  />
                  <ParamLabel text="Period" />
                  <NumberInput
                    value={exitRules.regimeDetection.period}
                    onChange={v => updateRule('regimeDetection', { period: v })}
                    min={1} max={200} step={1}
                  />
                  <ParamLabel text=">" />
                  <NumberInput
                    value={exitRules.regimeDetection.threshold}
                    onChange={v => updateRule('regimeDetection', { threshold: v })}
                    min={0} step={0.1}
                  />
                  <ParamLabel text="Action" />
                  <SelectInput
                    value={exitRules.regimeDetection.action}
                    options={RULE_ACTIONS.regimeDetection}
                    onChange={v => updateRule('regimeDetection', { action: v as 'reduce_all' | 'close_all' | 'halt_new_entry' })}
                  />
                  {exitRules.regimeDetection.action === 'reduce_all' && (
                    <NumberInput
                      value={exitRules.regimeDetection.reducePercent ?? 50}
                      onChange={v => updateRule('regimeDetection', { reducePercent: v })}
                      min={1} max={99} step={1} unit="%"
                    />
                  )}
                </>
              )}

              {/* Drawdown Limit params (P4) */}
              {meta.key === 'drawdownLimit' && (
                <>
                  <ParamLabel text="Max DD" />
                  <NumberInput
                    value={exitRules.drawdownLimit.maxDrawdown}
                    onChange={v => updateRule('drawdownLimit', { maxDrawdown: v })}
                    min={-100} max={0} step={0.5} unit="%"
                  />
                  <ParamLabel text="Action" />
                  <SelectInput
                    value={exitRules.drawdownLimit.action}
                    options={RULE_ACTIONS.drawdownLimit}
                    onChange={v => updateRule('drawdownLimit', { action: v as 'reduce_all' | 'close_all' | 'halt_trading' })}
                  />
                </>
              )}

              {/* Correlation Cap params (P5) */}
              {meta.key === 'correlationCap' && (
                <>
                  <ParamLabel text="Max Corr" />
                  <NumberInput
                    value={exitRules.correlationCap.maxCorrelation}
                    onChange={v => updateRule('correlationCap', { maxCorrelation: v })}
                    min={0} max={1} step={0.05}
                  />
                  <ParamLabel text="Lookback" />
                  <NumberInput
                    value={exitRules.correlationCap.lookbackDays}
                    onChange={v => updateRule('correlationCap', { lookbackDays: v })}
                    min={1} max={365} step={1} unit="days"
                  />
                  <ParamLabel text="Action" />
                  <SelectInput
                    value={exitRules.correlationCap.action}
                    options={RULE_ACTIONS.correlationCap}
                    onChange={v => updateRule('correlationCap', { action: v as 'skip_entry' | 'reduce_half' })}
                  />
                </>
              )}
            </RiskRuleRow>
          );
        })}

        {/* Hard Safety: always visible, no toggle */}
        <HardSafetyRow>
          <ParamLabel text="Max Loss" />
          <NumberInput
            value={exitRules.hardSafety.maxLossPercent}
            onChange={v => updateRule('hardSafety', { maxLossPercent: v })}
            min={-100} max={0} step={0.5} unit="%"
          />
        </HardSafetyRow>
      </div>

      {/* Combinator Config */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-color-terminal-surface/10 border border-color-terminal-border/50">
        <label className="text-sm text-color-terminal-text-secondary">{t('exitFactory.combinator')}</label>
        <select
          value={exitMethod}
          onChange={e => onMethodChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
        >
          {EXIT_COMBINATOR_METHODS.map(m => (
            <option key={m.id} value={m.id}>{t(`combinatorMethods.exit.${m.id}`)}</option>
          ))}
        </select>
      </div>
    </section>
  );
};

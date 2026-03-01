/**
 * PersonaSection Component
 *
 * TICKET_426_3: Persona constraint UI for Alpha Factory.
 * Persona dropdown + detail card + preference textarea.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserCircle } from 'lucide-react';
import { usePersonaList } from '../hooks/usePersonaList';

interface PersonaSectionProps {
  persona: string | null;
  setPersona: (value: string | null) => void;
  preference: string;
  setPreference: (value: string) => void;
}

const PREFERENCE_MAX_LENGTH = 500;

export const PersonaSection: React.FC<PersonaSectionProps> = ({
  persona,
  setPersona,
  preference,
  setPreference,
}) => {
  const { t } = useTranslation('quant-lab');
  const { personas, isLoading, error } = usePersonaList();

  const selectedPersona = personas.find(p => p.id === persona);

  return (
    <section className="p-6 rounded-lg border border-color-terminal-border bg-color-terminal-surface/30">
      <h2 className="text-lg font-semibold text-color-terminal-text-primary mb-4 flex items-center gap-2">
        <UserCircle className="w-5 h-5 text-color-terminal-accent-primary" />
        {t('persona.title')}
      </h2>

      {/* Persona Dropdown */}
      <div className="mb-4">
        <select
          value={persona ?? ''}
          onChange={(e) => setPersona(e.target.value || null)}
          className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm focus:outline-none focus:border-color-terminal-accent-primary"
          disabled={isLoading}
        >
          <option value="">{t('persona.noPersona')}</option>
          {personas.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-xs text-red-400">{t('persona.loadError')}</p>
        )}
      </div>

      {/* Detail Card */}
      {selectedPersona && (
        <div className="mb-4 p-4 rounded border border-color-terminal-border bg-color-terminal-surface/20 text-sm space-y-2">
          {selectedPersona.description.must_include.length > 0 && (
            <div className="flex gap-2">
              <span className="text-color-terminal-text-secondary font-medium min-w-[120px]">
                {t('persona.mustInclude')}:
              </span>
              <span className="text-color-terminal-text-primary">
                {selectedPersona.description.must_include.join(', ')}
              </span>
            </div>
          )}
          {selectedPersona.description.regime_bias.length > 0 && (
            <div className="flex gap-2">
              <span className="text-color-terminal-text-secondary font-medium min-w-[120px]">
                {t('persona.regimeBias')}:
              </span>
              <span className="text-color-terminal-text-primary">
                {selectedPersona.description.regime_bias.join(', ')}
              </span>
            </div>
          )}
          {selectedPersona.description.holding_period && (
            <div className="flex gap-2">
              <span className="text-color-terminal-text-secondary font-medium min-w-[120px]">
                {t('persona.holdingPeriod')}:
              </span>
              <span className="text-color-terminal-text-primary">
                {selectedPersona.description.holding_period}
              </span>
            </div>
          )}
          {selectedPersona.description.risk_style && (
            <div className="flex gap-2">
              <span className="text-color-terminal-text-secondary font-medium min-w-[120px]">
                {t('persona.riskStyle')}:
              </span>
              <span className="text-color-terminal-text-primary">
                {selectedPersona.description.risk_style}
              </span>
            </div>
          )}
          {selectedPersona.description.forbidden.length > 0 && (
            <div className="flex gap-2">
              <span className="text-color-terminal-text-secondary font-medium min-w-[120px]">
                {t('persona.forbidden')}:
              </span>
              <span className="text-red-400">
                {selectedPersona.description.forbidden.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Preference Textarea */}
      <div>
        <label className="block text-sm text-color-terminal-text-secondary mb-1">
          {t('persona.preferenceLabel')}
        </label>
        <textarea
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          placeholder={t('persona.preferencePlaceholder')}
          maxLength={PREFERENCE_MAX_LENGTH}
          rows={2}
          className="w-full px-3 py-2 rounded border border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-primary text-sm resize-none focus:outline-none focus:border-color-terminal-accent-primary placeholder:text-color-terminal-text-secondary/50"
        />
        <div className="text-right text-xs text-color-terminal-text-secondary mt-1">
          {t('persona.charCount', { current: preference.length, max: PREFERENCE_MAX_LENGTH })}
        </div>
      </div>
    </section>
  );
};

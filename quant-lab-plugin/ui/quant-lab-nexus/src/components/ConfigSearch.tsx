/**
 * ConfigSearch Component
 *
 * PLUGIN_TICKET_012: Search input for filtering saved configurations.
 * Follows ConversationSearch (TICKET_077) pattern.
 * TICKET_422_6: Internationalized with i18n translations
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

export interface ConfigSearchProps {
  value: string;
  onChange: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ConfigSearch: React.FC<ConfigSearchProps> = ({
  value,
  onChange,
  onClear,
  placeholder,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation('quant-lab');
  const displayPlaceholder = placeholder || t('configSearch.placeholder');
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && value) {
        e.preventDefault();
        onClear();
      }
    },
    [value, onClear]
  );

  return (
    <div className={['relative flex items-center', 'mx-4 mb-3', className].join(' ')}>
      <Search
        className="absolute left-3 w-4 h-4 text-color-terminal-text-muted pointer-events-none"
      />

      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={displayPlaceholder}
        disabled={disabled}
        autoComplete="off"
        aria-label={t('configSearch.placeholder')}
        className={[
          'w-full',
          'pl-10 pr-8 py-2',
          'bg-color-terminal-surface',
          'border border-color-terminal-border',
          'rounded-lg',
          'text-sm text-color-terminal-text',
          'placeholder:text-color-terminal-text-muted/70',
          'outline-none',
          'transition-all duration-200',
          'focus:border-color-terminal-accent-primary',
          'focus:ring-1 focus:ring-color-terminal-accent-primary/30',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      />

      {value && !disabled && (
        <button
          type="button"
          onClick={onClear}
          className={[
            'absolute right-2',
            'p-1 rounded',
            'text-color-terminal-text-muted',
            'transition-colors duration-200',
            'hover:text-color-terminal-text',
            'hover:bg-color-terminal-surface-hover',
          ].join(' ')}
          aria-label={t('configSearch.clear')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

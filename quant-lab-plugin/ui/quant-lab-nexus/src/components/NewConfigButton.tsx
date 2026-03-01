/**
 * NewConfigButton Component
 *
 * PLUGIN_TICKET_012: Button to create a new Alpha Factory configuration.
 * Follows NewChatButton (TICKET_077) pattern.
 * TICKET_422_6: Internationalized with i18n translations
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus } from 'lucide-react';

export interface NewConfigButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export const NewConfigButton: React.FC<NewConfigButtonProps> = ({
  onClick,
  disabled = false,
  label,
  className = '',
}) => {
  const { t } = useTranslation('quant-lab');
  const displayLabel = label || t('newConfigButton.create');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center justify-center gap-2',
        'px-4 py-3 mx-4 mt-4 mb-4',
        'bg-color-terminal-accent-primary text-color-terminal-bg',
        'rounded-lg',
        'text-sm font-medium',
        'cursor-pointer',
        'transition-all duration-200',
        'hover:bg-color-terminal-accent-primary/90',
        'hover:shadow-lg hover:shadow-color-terminal-accent-primary/20',
        'active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'disabled:hover:bg-color-terminal-accent-primary',
        'disabled:hover:shadow-none',
        'disabled:active:scale-100',
        className,
      ].join(' ')}
      aria-label={displayLabel}
    >
      <FolderPlus className="w-4 h-4" />
      <span>{displayLabel}</span>
    </button>
  );
};

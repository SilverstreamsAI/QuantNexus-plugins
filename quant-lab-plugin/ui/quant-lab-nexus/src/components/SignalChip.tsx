/**
 * SignalChip Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Reusable chip for both signal and exit items.
 */

import React from 'react';
import { X } from 'lucide-react';

interface SignalChipProps {
  name: string;
  onRemove: () => void;
  variant?: 'signal' | 'exit';
}

export const SignalChip: React.FC<SignalChipProps> = ({
  name,
  onRemove,
  variant = 'signal',
}) => {
  const accentClass = variant === 'signal'
    ? 'border-color-terminal-accent-primary/50 hover:border-color-terminal-accent-primary'
    : 'border-color-terminal-accent-teal/50 hover:border-color-terminal-accent-teal';

  return (
    <div className={`group h-10 px-3 rounded-lg border ${accentClass} bg-color-terminal-surface flex items-center gap-2 transition-colors`}>
      <span className="text-sm text-color-terminal-text-primary">{name}</span>
      <button
        onClick={onRemove}
        className="w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
      >
        <X className="w-3 h-3 text-color-terminal-text-secondary hover:text-red-400" />
      </button>
    </div>
  );
};

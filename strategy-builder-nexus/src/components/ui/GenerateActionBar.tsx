/**
 * GenerateActionBar Component (TICKET_298)
 *
 * Shared Zone D action bar for all Builder pages.
 * Replaces duplicated generate button code with a centralized component.
 *
 * States:
 * - Initial: Single full-width gold "Start Generate" button
 * - Generating: Single full-width disabled spinner button
 * - Success: Dual layout - REGENERATE (ghost, left) + RETURN (teal, right)
 *
 * REGENERATE requires confirmation via globalThis.nexus.window.showConfirm().
 * RETURN navigates back to NONA hub via globalThis.nexus.window API.
 *
 * @see TICKET_298 - Builder Post-Generation Action Bar Redesign
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2, RotateCcw, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GenerateActionBarProps {
  isGenerating: boolean;
  hasResult: boolean;
  onGenerate: () => void;
  generateLabel?: string;
  generatingLabel?: string;
}

export const GenerateActionBar: React.FC<GenerateActionBarProps> = ({
  isGenerating,
  hasResult,
  onGenerate,
  generateLabel,
  generatingLabel,
}) => {
  const { t } = useTranslation('strategy-builder');
  const genLabel = generateLabel || t('ui.generateActionBarLabels.startGenerate');
  const geningLabel = generatingLabel || t('ui.generateActionBarLabels.generating');
  const regenerateLabel = t('ui.generateActionBarLabels.regenerate');
  const returnLabel = t('ui.generateActionBarLabels.return');
  const regenerateConfirmMsg = t('ui.generateActionBarLabels.regenerateConfirmMsg');
  const regenerateConfirmTitle = t('ui.generateActionBarLabels.regenerateConfirmTitle');
  // TICKET_300: Only navigate - breadcrumbs auto-derived from view state
  const handleReturn = useCallback(() => {
    globalThis.nexus?.window?.openView('strategy.hub');
  }, []);

  const handleRegenerate = useCallback(async () => {
    const confirmed = await globalThis.nexus?.window?.showConfirm(
      regenerateConfirmMsg,
      { title: regenerateConfirmTitle }
    );
    if (confirmed) {
      onGenerate();
    }
  }, [onGenerate, regenerateConfirmMsg, regenerateConfirmTitle]);

  return (
    <div className="flex-shrink-0 border-t border-color-terminal-border bg-color-terminal-surface/50 p-4">
      {isGenerating ? (
        // Generating state: single disabled button
        <button
          disabled
          className={cn(
            'w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all',
            'border-color-terminal-border bg-color-terminal-surface text-color-terminal-text-muted cursor-not-allowed'
          )}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          {geningLabel}
        </button>
      ) : hasResult ? (
        // Success state: dual layout - REGENERATE (left) + RETURN (right)
        <div className="flex justify-between gap-3">
          <button
            onClick={handleRegenerate}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all',
              'border-color-terminal-border text-color-terminal-text-muted hover:text-color-terminal-accent-gold hover:border-color-terminal-accent-gold'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            {regenerateLabel}
          </button>
          <button
            onClick={handleReturn}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all',
              'border-color-terminal-accent-teal bg-color-terminal-accent-teal/10 text-color-terminal-accent-teal hover:bg-color-terminal-accent-teal/20'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            {returnLabel}
          </button>
        </div>
      ) : (
        // Initial state: single gold button
        <button
          onClick={onGenerate}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider border rounded transition-all',
            'border-color-terminal-accent-gold bg-color-terminal-accent-gold/10 text-color-terminal-accent-gold hover:bg-color-terminal-accent-gold/20'
          )}
        >
          <Play className="w-4 h-4" />
          {genLabel}
        </button>
      )}
    </div>
  );
};

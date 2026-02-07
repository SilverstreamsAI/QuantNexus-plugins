/**
 * FeatureCard Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Reusable feature card for hub landing page.
 */

import React from 'react';

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description, onClick }) => {
  const handleClick = () => {
    console.log('[FeatureCard] Clicked:', title, 'hasOnClick:', !!onClick);
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border border-color-terminal-border bg-color-terminal-surface/50 hover:border-color-terminal-accent-primary/50 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className="w-5 h-5 text-color-terminal-accent-primary" />
        <h3 className="font-medium text-color-terminal-text-primary">{title}</h3>
      </div>
      <p className="text-sm text-color-terminal-text-secondary">{description}</p>
    </div>
  );
};

/**
 * FlowDivider Component
 *
 * PLUGIN_TICKET_006: Extracted from QuantLabPage.tsx
 * PLUGIN_TICKET_008: Migrated from host to plugin
 * Vertical arrow/line between sections indicating data flow direction.
 */

import React from 'react';

export const FlowDivider: React.FC = () => {
  return (
    <div className="flex justify-center">
      <div className="w-px h-8 bg-color-terminal-accent-primary/50" />
    </div>
  );
};

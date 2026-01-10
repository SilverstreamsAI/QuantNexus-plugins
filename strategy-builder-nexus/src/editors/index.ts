/**
 * Strategy Plugin Editor Registry
 *
 * Maps viewType to React component for dynamic page routing.
 * Host layer queries this registry instead of hardcoding imports.
 *
 * @see TICKET_079 - Dynamic Page Routing Architecture
 * @see TICKET_056 - VS Code Plugin Architecture
 */

import React from 'react';
import { RegimeDetectorPage } from '../components/pages/RegimeDetectorPage';
import { EntrySignalPage } from '../components/pages/EntrySignalPage';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Props passed to editor components
 */
export interface EditorProps {
  onGenerate?: (config: unknown) => Promise<void>;
  onSettingsClick?: () => void;
  pageTitle?: string;
}

/**
 * Editor provider definition
 */
export interface EditorProvider {
  component: React.ComponentType<EditorProps>;
}

// -----------------------------------------------------------------------------
// Editor Registry
// -----------------------------------------------------------------------------

/**
 * Editor Provider Registry
 *
 * Maps viewType (from manifest.json) to React component.
 * viewType must match manifest.contributes.editors[].viewType
 */
export const EDITOR_PROVIDERS: Record<string, EditorProvider> = {
  'strategy.regimeDetector': {
    component: RegimeDetectorPage,
  },
  'strategy.entrySignal': {
    component: EntrySignalPage,
  },
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get editor component by viewType
 *
 * @param viewType - The viewType from manifest.json
 * @returns React component or null if not found
 */
export function getEditorComponent(viewType: string): React.ComponentType<EditorProps> | null {
  return EDITOR_PROVIDERS[viewType]?.component ?? null;
}

/**
 * Check if editor exists for viewType
 *
 * @param viewType - The viewType to check
 * @returns true if editor exists
 */
export function hasEditor(viewType: string): boolean {
  return viewType in EDITOR_PROVIDERS;
}

/**
 * Get all registered viewTypes
 *
 * @returns Array of registered viewType strings
 */
export function getRegisteredViewTypes(): string[] {
  return Object.keys(EDITOR_PROVIDERS);
}

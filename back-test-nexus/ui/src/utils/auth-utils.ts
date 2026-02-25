/**
 * Centralized user ID retrieval for Plugin Renderer process.
 * Single source of truth - all services import from here.
 * Fail-fast: throws if not authenticated (no silent fallbacks).
 *
 * TICKET_420: Fix hardcoded userId='default' in algorithmService queries.
 * Replicates pattern from strategy-builder-nexus/src/utils/auth-utils.ts.
 */

export async function getCurrentUserIdAsString(): Promise<string> {
  if (!window.electronAPI.auth) {
    throw new Error('Auth API not available');
  }
  const result = await window.electronAPI.auth.getUser();
  if (!result?.success || !result.data?.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return result.data.id;
}

/**
 * Centralized user ID retrieval for Plugin Renderer process.
 * Single source of truth - all services import from here.
 * Fail-fast: throws if not authenticated (no silent fallbacks).
 */

export async function getCurrentUserId(): Promise<number> {
  if (!window.electronAPI.auth) {
    throw new Error('Auth API not available');
  }
  const result = await window.electronAPI.auth.getUser();
  if (!result?.success || !result.data?.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  const userId = parseInt(result.data.id, 10);
  if (isNaN(userId)) {
    throw new Error('Invalid user ID format: ' + result.data.id);
  }
  return userId;
}

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

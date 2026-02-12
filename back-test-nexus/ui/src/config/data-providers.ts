/**
 * Data Provider Configuration
 *
 * TICKET_308: Data provider credential definitions for SecretsTab.
 * Maps manifest secret keys to validation provider IDs.
 *
 * Alpaca requires a key pair (API Key ID + Secret Key) combined
 * as "keyId:secretKey" for validation.
 */

// =============================================================================
// Types
// =============================================================================

export interface DataProvider {
  /** Provider ID matching api-key-validator.ts PROVIDER_CONFIGS key */
  id: string;
  /** Display name */
  name: string;
  /** Primary secret key in manifest (shows test button) */
  primarySecretKey: string;
  /** All secret keys that form the credential (ordered for validation) */
  secretKeys: string[];
  /** URL for obtaining credentials */
  docsUrl?: string;
}

// =============================================================================
// Provider Definitions
// =============================================================================

export const DATA_PROVIDERS: DataProvider[] = [
  {
    id: 'ALPACA',
    name: 'Alpaca Markets',
    primarySecretKey: 'alpaca.apiKeyId',
    secretKeys: ['alpaca.apiKeyId', 'alpaca.apiSecretKey'],
    docsUrl: 'https://app.alpaca.markets/paper/dashboard/overview',
  },
];

// =============================================================================
// Lookup Helpers
// =============================================================================

/** Find provider config by secret key */
export function getProviderBySecretKey(secretKey: string): DataProvider | undefined {
  return DATA_PROVIDERS.find(p => p.secretKeys.includes(secretKey));
}

/** Check if a secret key is the primary key (shows test button) */
export function isPrimarySecretKey(secretKey: string): boolean {
  return DATA_PROVIDERS.some(p => p.primarySecretKey === secretKey);
}

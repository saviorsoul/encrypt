/** Practical cap for JSON in a deep-link payload (OS argv / URL length limits). */
export const MAX_FEED_BRIDGE_PAYLOAD_LENGTH = 32 * 1024;

export const FEED_BRIDGE_RESULT_STORAGE_PREFIX = 'encrypt:bridge-result:';

export const FEED_BRIDGE_PAIRING_STORAGE_KEY =
  'encrypt:feed-lab-bridge-pairing';

/** Ephemeral cross-tab handoff for pairing completion (localStorage only). */
export const FEED_BRIDGE_PENDING_PAIR_STORAGE_PREFIX =
  'encrypt:bridge-pending-pair:';

export const FEED_BRIDGE_REQUEST_TIMEOUT_MS = 60_000;

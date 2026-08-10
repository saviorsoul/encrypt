/**
 * Parse and validate encrypt:// deep links from the browser extension / OS.
 *
 * Contract:
 * - encrypt://encrypt?text=<urlencoded>
 * - encrypt://decrypt?text=<urlencoded>
 * - encrypt://copy-public-key
 * - encrypt://feed-pair?origin=…&session=…&callback=…
 * - encrypt://feed-op?session=…&requestId=…&op=…&payload=…
 */

import { validateFeedLabPairCallback } from './feedLabBridgeOpenExternal.js';

/** Practical cap for decrypt JSON in a URL (OS argv / URL length limits). */
export const MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH = 32 * 1024;

/** Practical cap for feed bridge payload in a URL. */
export const MAX_FEED_BRIDGE_PAYLOAD_LENGTH = 32 * 1024;

const PROTOCOL = 'encrypt:';

const FEED_BRIDGE_OPS = new Set(['ecdh-agree', 'ecdsa-sign', 'op-quick']);

/**
 * @param {import('./deepLinks.js').DeepLinkAction | { type: string; op?: string }} action
 */
export function isBackgroundFeedBridgeDeepLinkAction(action) {
  return action?.type === 'feed-op' && action.op === 'op-quick';
}

/**
 * @typedef {| { type: 'copy-public-key' }
 *   | { type: 'encrypt'; text: string }
 *   | { type: 'decrypt'; text: string }
 *   | { type: 'feed-pair'; origin: string; session: string; callback: string }
 *   | { type: 'feed-op'; session: string; requestId: string; op: string; payload: string }
 * } DeepLinkAction
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
function isEncryptProtocolUrl(value) {
  return typeof value === 'string' && /^encrypt:\/\//i.test(value.trim());
}

/**
 * Find the first encrypt:// URL in argv (Windows/Linux protocol launch).
 * @param {string[]} argv
 * @returns {string | null}
 */
export function findDeepLinkInArgv(argv) {
  if (!Array.isArray(argv)) {
    return null;
  }

  for (const arg of argv) {
    if (typeof arg !== 'string' || !arg) {
      continue;
    }

    const trimmed = arg.trim().replace(/^['"]|['"]$/g, '');
    if (isEncryptProtocolUrl(trimmed)) {
      return trimmed;
    }

    // Some launchers embed the URL inside a larger argument.
    const embedded = trimmed.match(/encrypt:\/\/[^\s'"]+/i);
    if (embedded) {
      return embedded[0];
    }
  }

  return null;
}

/**
 * @param {string} text
 * @param {string} emptyError
 * @returns {{ ok: true; text: string } | { ok: false; error: string }}
 */
function validateNonEmptyTextParam(text, emptyError) {
  if (typeof text !== 'string' || !text) {
    return { ok: false, error: emptyError };
  }

  return { ok: true, text };
}

/**
 * @param {string} text
 * @param {number} maxLength
 * @param {string} emptyError
 * @param {string} tooLongError
 * @returns {{ ok: true; text: string } | { ok: false; error: string }}
 */
function validateTextParam(text, maxLength, emptyError, tooLongError) {
  if (typeof text !== 'string' || !text) {
    return { ok: false, error: emptyError };
  }

  if (text.length > maxLength) {
    return { ok: false, error: tooLongError };
  }

  return { ok: true, text };
}

/**
 * @param {string} href
 * @returns {{ ok: true; action: DeepLinkAction } | { ok: false; error: string }}
 */
export function parseDeepLink(href) {
  if (!isEncryptProtocolUrl(href)) {
    return { ok: false, error: 'Not an encrypt:// URL.' };
  }

  let url;
  try {
    url = new URL(href.trim());
  } catch {
    return { ok: false, error: 'Invalid encrypt:// URL.' };
  }

  if (url.protocol.toLowerCase() !== PROTOCOL) {
    return { ok: false, error: 'Not an encrypt:// URL.' };
  }

  const action = (url.hostname || '').toLowerCase();
  if (!action) {
    return { ok: false, error: 'Missing encrypt:// action.' };
  }

  if (url.pathname && url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, error: 'Unexpected path in encrypt:// URL.' };
  }

  const params = url.searchParams;

  if (action === 'copy-public-key') {
    if ([...params.keys()].length > 0) {
      return {
        ok: false,
        error: 'encrypt://copy-public-key does not accept query params.',
      };
    }
    return { ok: true, action: { type: 'copy-public-key' } };
  }

  if (action === 'encrypt') {
    const allowedKeys = new Set(['text']);
    for (const key of params.keys()) {
      if (!allowedKeys.has(key)) {
        return {
          ok: false,
          error: `Unexpected query param "${key}" for encrypt://encrypt.`,
        };
      }
    }

    const textResult = validateNonEmptyTextParam(
      params.get('text') ?? '',
      'encrypt://encrypt requires a non-empty text param.',
    );
    if (!textResult.ok) {
      return textResult;
    }

    return { ok: true, action: { type: 'encrypt', text: textResult.text } };
  }

  if (action === 'decrypt') {
    const allowedKeys = new Set(['text']);
    for (const key of params.keys()) {
      if (!allowedKeys.has(key)) {
        return {
          ok: false,
          error: `Unexpected query param "${key}" for encrypt://decrypt.`,
        };
      }
    }

    const textResult = validateTextParam(
      params.get('text') ?? '',
      MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH,
      'encrypt://decrypt requires a non-empty text param.',
      `Decrypt text exceeds the maximum length (${MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH} characters).`,
    );
    if (!textResult.ok) {
      return textResult;
    }

    return { ok: true, action: { type: 'decrypt', text: textResult.text } };
  }

  if (action === 'feed-pair') {
    const allowedKeys = new Set([
      'origin',
      'session',
      'callback',
      'bridgeSessionKeyId',
      'bridgeSessionPublicJwk',
    ]);
    for (const key of params.keys()) {
      if (!allowedKeys.has(key)) {
        return {
          ok: false,
          error: `Unexpected query param "${key}" for encrypt://feed-pair.`,
        };
      }
    }

    const originResult = validateNonEmptyTextParam(
      params.get('origin') ?? '',
      'encrypt://feed-pair requires a non-empty origin param.',
    );
    if (!originResult.ok) {
      return originResult;
    }

    const sessionResult = validateNonEmptyTextParam(
      params.get('session') ?? '',
      'encrypt://feed-pair requires a non-empty session param.',
    );
    if (!sessionResult.ok) {
      return sessionResult;
    }

    const callbackResult = validateNonEmptyTextParam(
      params.get('callback') ?? '',
      'encrypt://feed-pair requires a non-empty callback param.',
    );
    if (!callbackResult.ok) {
      return callbackResult;
    }

    const pairCallbackError = validateFeedLabPairCallback(
      callbackResult.text,
      originResult.text,
    );
    if (pairCallbackError) {
      return { ok: false, error: pairCallbackError };
    }

    return {
      ok: true,
      action: {
        type: 'feed-pair',
        origin: originResult.text,
        session: sessionResult.text,
        callback: callbackResult.text,
        bridgeSessionKeyId: params.get('bridgeSessionKeyId') ?? '',
        bridgeSessionPublicJwk: params.get('bridgeSessionPublicJwk') ?? '',
      },
    };
  }

  if (action === 'feed-op') {
    const allowedKeys = new Set([
      'session',
      'requestId',
      'op',
      'payload',
      'origin',
      'callback',
      'bridgeSessionKeyId',
      'bridgeSessionPublicJwk',
    ]);
    for (const key of params.keys()) {
      if (!allowedKeys.has(key)) {
        return {
          ok: false,
          error: `Unexpected query param "${key}" for encrypt://feed-op.`,
        };
      }
    }

    const sessionResult = validateNonEmptyTextParam(
      params.get('session') ?? '',
      'encrypt://feed-op requires a non-empty session param.',
    );
    if (!sessionResult.ok) {
      return sessionResult;
    }

    const requestIdResult = validateNonEmptyTextParam(
      params.get('requestId') ?? '',
      'encrypt://feed-op requires a non-empty requestId param.',
    );
    if (!requestIdResult.ok) {
      return requestIdResult;
    }

    const op = (params.get('op') ?? '').trim();
    if (!FEED_BRIDGE_OPS.has(op)) {
      return { ok: false, error: `Unknown feed bridge operation "${op}".` };
    }

    const payloadResult = validateTextParam(
      params.get('payload') ?? '',
      MAX_FEED_BRIDGE_PAYLOAD_LENGTH,
      'encrypt://feed-op requires a non-empty payload param.',
      `Feed bridge payload exceeds the maximum length (${MAX_FEED_BRIDGE_PAYLOAD_LENGTH} characters).`,
    );
    if (!payloadResult.ok) {
      return payloadResult;
    }

    return {
      ok: true,
      action: {
        type: 'feed-op',
        session: sessionResult.text,
        requestId: requestIdResult.text,
        op,
        payload: payloadResult.text,
        origin: params.get('origin') ?? '',
        callback: params.get('callback') ?? '',
        bridgeSessionKeyId: params.get('bridgeSessionKeyId') ?? '',
        bridgeSessionPublicJwk: params.get('bridgeSessionPublicJwk') ?? '',
      },
    };
  }

  return { ok: false, error: `Unknown encrypt:// action "${action}".` };
}

/**
 * Build an encrypt:// URL (used by tests / extension shared helpers mirrored in JS).
 * @param {'copy-public-key' | 'encrypt' | 'decrypt'} type
 * @param {{ text?: string }} [options]
 * @returns {string}
 */
export function buildDeepLink(type, options = {}) {
  if (type === 'copy-public-key') {
    return `encrypt://${type}`;
  }

  const params = new URLSearchParams();
  if (typeof options.text === 'string') {
    params.set('text', options.text);
  }

  const query = params.toString();
  return query ? `encrypt://${type}?${query}` : `encrypt://${type}`;
}

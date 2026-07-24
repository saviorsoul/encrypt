/**
 * Parse and validate encrypt:// deep links from the browser extension / OS.
 *
 * Contract:
 * - encrypt://encrypt?text=<urlencoded>
 * - encrypt://decrypt?text=<urlencoded>
 * - encrypt://copy-public-key
 */

/** Practical cap for decrypt JSON in a URL (OS argv / URL length limits). */
export const MAX_DEEP_LINK_DECRYPT_TEXT_LENGTH = 32 * 1024;

const PROTOCOL = 'encrypt:';

/**
 * @typedef {| { type: 'copy-public-key' }
 *   | { type: 'encrypt'; text: string }
 *   | { type: 'decrypt'; text: string }
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

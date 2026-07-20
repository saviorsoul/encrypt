import { describe, expect, it } from 'vitest';
import {
  MANIFEST_WRAP,
  MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH,
} from '../constants.js';
import { getValidator } from '../lib/ajv.js';

const SAMPLE_KEY_ID = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';

const ecPublicJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'x',
  y: 'y',
} as const;

function minimalCreateMessageRequest(
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    version: 9,
    wrap: MANIFEST_WRAP,
    senderPublicJwk: ecPublicJwk,
    ephemeralPublicKey: ecPublicJwk,
    encryptedContent: { iv: 'iv', ciphertext: 'ciphertext' },
    senderSignature: 'signature',
    keyManifest: {
      [SAMPLE_KEY_ID]: {
        keyId: SAMPLE_KEY_ID,
        iv: 'iv',
        salt: 'salt',
        encryptedDek: 'dek',
      },
    },
    ...extra,
  };
}

describe('createMessageRequest schema', () => {
  it('accepts feed copy messageId and strips it after validation', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      messageId: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(validate(body)).toBe(true);
    expect(body).not.toHaveProperty('messageId');
    expect(body).toHaveProperty('keyManifest');
  });

  it('rejects unknown additional properties', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({ copiedFrom: 'feed' });

    expect(validate(body)).toBe(false);
    expect(
      validate.errors?.some((e) => e.keyword === 'additionalProperties'),
    ).toBe(true);
  });

  it('rejects invalid messageId format', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({ messageId: 'not-a-uuid' });

    expect(validate(body)).toBe(false);
  });

  it('accepts ciphertext at the content limit', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      encryptedContent: {
        iv: 'AAAAAAAAAAAA',
        ciphertext: 'A'.repeat(MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH),
      },
    });

    expect(validate(body)).toBe(true);
  });

  it('rejects ciphertext longer than the content limit', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      encryptedContent: {
        iv: 'AAAAAAAAAAAA',
        ciphertext: 'A'.repeat(MAX_CONTENT_CIPHERTEXT_BASE64_LENGTH + 1),
      },
    });

    expect(validate(body)).toBe(false);
    expect(
      validate.errors?.some((e) => e.instancePath.includes('ciphertext')),
    ).toBe(true);
  });
});

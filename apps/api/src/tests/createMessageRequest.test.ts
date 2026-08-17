import { describe, expect, it } from 'vitest';
import { ES256_SIGNATURE_BASE64_BODY_LENGTH } from '@encrypt/core/crypto/es256Constants';
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
    senderSignature: 'A'.repeat(ES256_SIGNATURE_BASE64_BODY_LENGTH) + '==',
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

  it('accepts a real ES256 signature with standard base64 padding', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      senderSignature:
        'oLkvht46O7pdgA/bLBfp2rq8dapNYPoJtKPc2Xf/0Oq8mMkEoMRPgdWf0HqlBmH6Wj5yAMjYZn/JIbTEaq1DTw==',
    });

    expect(validate(body)).toBe(true);
  });

  it('rejects senderSignature shorter than ES256 wire length', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      senderSignature: 'short',
    });

    expect(validate(body)).toBe(false);
    expect(
      validate.errors?.some((e) => e.instancePath === '/senderSignature'),
    ).toBe(true);
  });

  it('rejects senderSignature with invalid base64 alphabet', () => {
    const validate = getValidator('createMessageRequest');
    const body = minimalCreateMessageRequest({
      senderSignature: '_'.repeat(ES256_SIGNATURE_BASE64_BODY_LENGTH) + '==',
    });

    expect(validate(body)).toBe(false);
    expect(
      validate.errors?.some((e) => e.instancePath === '/senderSignature'),
    ).toBe(true);
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

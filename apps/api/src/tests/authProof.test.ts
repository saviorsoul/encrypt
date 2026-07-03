import { describe, expect, it } from 'vitest';
import {
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { bytesToBase64, base64ToBytes } from '@encrypt/core/utils/bytes';
import {
  assertAuthKeyIdMatchesPublicKey,
  buildAuthSignable,
  computeAuthTimeSlot,
  isAuthTimeSlotAccepted,
  parseAuthNonceHeader,
  parseAuthTimeSlotHeader,
  signAuthProof,
  verifyAuthProof,
  AUTH_SIGNABLE_VERSION,
  AUTH_TIME_SLOT_SECONDS,
  AUTH_TIME_SLOT_SKEW,
  AUTH_NONCE_BYTES,
  generateAuthNonce,
} from '@encrypt/core/crypto/authProof';

const TEST_NONCE = bytesToBase64(new Uint8Array(12).fill(0x11));
const OTHER_NONCE = bytesToBase64(new Uint8Array(12).fill(0x22));

describe('authProof', () => {
  it('generateAuthNonce returns 12-byte standard base64', () => {
    const nonce = generateAuthNonce();
    expect(parseAuthNonceHeader(nonce)).toBe(nonce);
    expect(base64ToBytes(nonce).length).toBe(AUTH_NONCE_BYTES);
  });

  it('signs and verifies a request-bound auth proof', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    const material = await importUploadedPrivateKeyMaterial(privateJwk);
    const timeSlot = computeAuthTimeSlot();
    const request = {
      method: 'GET',
      path: '/api/inbox',
      query: null,
      body: undefined,
    };

    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: TEST_NONCE },
      request,
    );

    const publicJwk = slimEcPublicJwk(privateJwk);
    await verifyAuthProof(
      publicJwk,
      material.keyId,
      { timeSlot, nonce: TEST_NONCE },
      signature,
      request,
    );
  });

  it('rejects proofs for a different route', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    const material = await importUploadedPrivateKeyMaterial(privateJwk);
    const timeSlot = computeAuthTimeSlot();
    const signedRequest = {
      method: 'GET',
      path: '/api/inbox',
      query: null,
    };
    const otherRequest = {
      method: 'POST',
      path: '/api/friendships/request',
      body: { targetKeyId: 'other' },
    };

    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: TEST_NONCE },
      signedRequest,
    );

    const publicJwk = slimEcPublicJwk(privateJwk);
    await expect(
      verifyAuthProof(
        publicJwk,
        material.keyId,
        { timeSlot, nonce: TEST_NONCE },
        signature,
        otherRequest,
      ),
    ).rejects.toThrow(/verification failed/i);
  });

  it('rejects proofs verified with a different nonce than signed', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    const material = await importUploadedPrivateKeyMaterial(privateJwk);
    const timeSlot = computeAuthTimeSlot();
    const request = {
      method: 'GET',
      path: '/api/inbox',
      query: null,
    };

    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: TEST_NONCE },
      request,
    );

    const publicJwk = slimEcPublicJwk(privateJwk);
    await expect(
      verifyAuthProof(
        publicJwk,
        material.keyId,
        { timeSlot, nonce: OTHER_NONCE },
        signature,
        request,
      ),
    ).rejects.toThrow(/verification failed/i);
  });

  describe('time-slot verification', () => {
    it('maps unix seconds into fixed-width slots', () => {
      expect(AUTH_TIME_SLOT_SECONDS).toBe(30);
      expect(computeAuthTimeSlot(0)).toBe(0);
      expect(computeAuthTimeSlot(29)).toBe(0);
      expect(computeAuthTimeSlot(30)).toBe(1);
      expect(computeAuthTimeSlot(59)).toBe(1);
      expect(computeAuthTimeSlot(60)).toBe(2);
    });

    it('parses X-Time-Slot header values', () => {
      expect(parseAuthTimeSlotHeader('0')).toBe(0);
      expect(parseAuthTimeSlotHeader('42')).toBe(42);
      expect(parseAuthTimeSlotHeader(undefined)).toBeNull();
      expect(parseAuthTimeSlotHeader('')).toBeNull();
      expect(parseAuthTimeSlotHeader('1.5')).toBeNull();
      expect(parseAuthTimeSlotHeader('-1')).toBeNull();
      expect(parseAuthTimeSlotHeader('abc')).toBeNull();
    });

    it('parses X-Nonce header values', () => {
      expect(parseAuthNonceHeader(TEST_NONCE)).toBe(TEST_NONCE);
      expect(parseAuthNonceHeader(`  ${TEST_NONCE}  `)).toBe(TEST_NONCE);
      expect(parseAuthNonceHeader(undefined)).toBeNull();
      expect(parseAuthNonceHeader('')).toBeNull();
      expect(parseAuthNonceHeader('abc')).toBeNull();
      expect(
        parseAuthNonceHeader('11111111-1111-4111-8111-111111111111'),
      ).toBeNull();
    });

    it('accepts the server slot and ±AUTH_TIME_SLOT_SKEW', () => {
      const now = 1_000_000;
      const serverSlot = computeAuthTimeSlot(now);

      expect(AUTH_TIME_SLOT_SKEW).toBe(1);
      expect(isAuthTimeSlotAccepted(serverSlot, now)).toBe(true);
      expect(isAuthTimeSlotAccepted(serverSlot - 1, now)).toBe(true);
      expect(isAuthTimeSlotAccepted(serverSlot + 1, now)).toBe(true);
    });

    it('rejects slots outside the accepted window', () => {
      const now = 1_000_000;
      const serverSlot = computeAuthTimeSlot(now);

      expect(isAuthTimeSlotAccepted(serverSlot - 2, now)).toBe(false);
      expect(isAuthTimeSlotAccepted(serverSlot + 2, now)).toBe(false);
      expect(isAuthTimeSlotAccepted(-1, now)).toBe(false);
      expect(isAuthTimeSlotAccepted(1.5, now)).toBe(false);
    });

    it('rejects proofs verified with a different timeSlot than signed', async () => {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const privateJwk = slimEcPrivateJwk(
        (await crypto.subtle.exportKey(
          'jwk',
          keyPair.privateKey,
        )) as JsonWebKey,
      );
      const material = await importUploadedPrivateKeyMaterial(privateJwk);
      const signedSlot = 100;
      const request = {
        method: 'GET',
        path: '/api/inbox',
        query: null,
      };

      const signature = await signAuthProof(
        material.ecdsaSignPrivateKey,
        material.keyId,
        { timeSlot: signedSlot, nonce: TEST_NONCE },
        request,
      );

      const publicJwk = slimEcPublicJwk(privateJwk);
      await expect(
        verifyAuthProof(
          publicJwk,
          material.keyId,
          { timeSlot: signedSlot + 1, nonce: TEST_NONCE },
          signature,
          request,
        ),
      ).rejects.toThrow(/verification failed/i);
    });

    it('includes timeSlot and nonce in the auth signable', async () => {
      const signable = await buildAuthSignable(
        'kid-1',
        { timeSlot: 99, nonce: TEST_NONCE },
        {
          method: 'GET',
          path: '/api/inbox',
          query: null,
        },
      );
      expect(signable.timeSlot).toBe(99);
      expect(signable.nonce).toBe(TEST_NONCE);
      expect(signable.v).toBe(AUTH_SIGNABLE_VERSION);
    });
  });

  it('asserts keyId matches public key coordinates', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    const material = await importUploadedPrivateKeyMaterial(privateJwk);

    await expect(
      assertAuthKeyIdMatchesPublicKey(material.keyId, material.publicKey),
    ).resolves.toBeUndefined();

    await expect(
      assertAuthKeyIdMatchesPublicKey('wrong-key-id', material.publicKey),
    ).rejects.toThrow(/thumbprint/i);
  });

  it('builds GET signable bodies without bodyHash', async () => {
    const signable = await buildAuthSignable(
      'kid-1',
      { timeSlot: 42, nonce: TEST_NONCE },
      {
        method: 'GET',
        path: '/api/users',
        query: null,
      },
    );
    expect(signable).toEqual({
      v: AUTH_SIGNABLE_VERSION,
      keyId: 'kid-1',
      method: 'GET',
      path: '/api/users',
      query: null,
      timeSlot: 42,
      nonce: TEST_NONCE,
    });
    expect('bodyHash' in signable).toBe(false);
    expect(AUTH_TIME_SLOT_SECONDS).toBe(30);
  });

  it('builds POST signable bodies with bodyHash', async () => {
    const signable = await buildAuthSignable(
      'kid-1',
      { timeSlot: 42, nonce: TEST_NONCE },
      {
        method: 'POST',
        path: '/api/users',
        query: null,
        body: { publicKey: { x: '1', y: '2' } },
      },
    );
    expect(signable.v).toBe(AUTH_SIGNABLE_VERSION);
    expect(signable.method).toBe('POST');
    expect(signable.nonce).toBe(TEST_NONCE);
    expect('bodyHash' in signable).toBe(true);
    if ('bodyHash' in signable) {
      expect(typeof signable.bodyHash).toBe('string');
    }
  });
});

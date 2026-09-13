import { afterEach, describe, expect, it } from 'vitest';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import {
  AUTH_HEADER_KEY_ID,
  AUTH_HEADER_NONCE,
  AUTH_HEADER_PUBLIC_KEY,
  AUTH_HEADER_SIGNATURE,
  AUTH_HEADER_TIME_SLOT,
  authHeadersToRecord,
  computeAuthTimeSlot,
  formatAuthPublicKeyWire,
  signAuthProof,
} from '@encrypt/core/crypto/authProof';
import {
  ES256_SIGNATURE_BASE64_BODY_LENGTH,
  ES256_SIGNATURE_BASE64_LENGTH,
} from '@encrypt/core/crypto/es256Constants';
import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { bytesToBase64 } from '@encrypt/core/utils/bytes';
import type { AuthHeadersWire } from '../schemas/common.js';
import { getHeaderValidator } from '../lib/headerAjv.js';
import { authenticate } from '../middleware/authenticate.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createAuthRouter } from '../routes/auth.js';
import {
  createMemoryAuthNonceStore,
  setAuthNonceStoreForTests,
} from '@/contexts/auth/index.js';
import { requestApp } from './requestApp.js';

const validate = getHeaderValidator('authHeadersWire');

function validWire(overrides?: Partial<AuthHeadersWire>): AuthHeadersWire {
  return {
    keyId: 'A'.repeat(43),
    publicKey: `${'A'.repeat(43)};${'B'.repeat(43)}`,
    timeSlot: 42,
    nonce: bytesToBase64(new Uint8Array(12).fill(0x41)),
    signature: `${'A'.repeat(ES256_SIGNATURE_BASE64_BODY_LENGTH)}==`,
    ...overrides,
  };
}

async function createTestMaterial() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const privateJwk = slimEcPrivateJwk(
    (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
  );
  return importUploadedPrivateKeyMaterial(privateJwk);
}

function createAuthProbeApp(): Koa {
  const app = new Koa();
  app.use(errorHandler());
  app.use(bodyParser());
  const authRouter = createAuthRouter();
  app.use(authRouter.routes()).use(authRouter.allowedMethods());
  app.use(authenticate());
  app.use((ctx) => {
    ctx.body = { ok: true };
  });
  return app;
}

describe('authHeadersWire schema', () => {
  it('accepts a minimal valid wire object', () => {
    expect(validate(validWire())).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { keyId, ...rest } = validWire();
    void keyId;
    expect(validate(rest)).toBe(false);
  });

  it('rejects unknown additional properties', () => {
    expect(validate({ ...validWire(), injected: 'x' })).toBe(false);
    expect(
      validate.errors?.some(
        (error) => error.keyword === 'additionalProperties',
      ),
    ).toBe(true);
  });

  it('rejects keyId with invalid length or charset', () => {
    expect(validate(validWire({ keyId: 'short' }))).toBe(false);
    expect(validate(validWire({ keyId: 'A'.repeat(44) }))).toBe(false);
    expect(validate(validWire({ keyId: `${'A'.repeat(42)}+` }))).toBe(false);
  });

  it('rejects publicKey without fixed-width x;y coordinates', () => {
    expect(validate(validWire({ publicKey: 'not-coordinates' }))).toBe(false);
    expect(validate(validWire({ publicKey: 'a;b' }))).toBe(false);
    expect(
      validate(
        validWire({
          publicKey: `${'A'.repeat(43)};${'B'.repeat(42)}`,
        }),
      ),
    ).toBe(false);
    expect(
      validate(
        validWire({
          publicKey: `${'A'.repeat(43)}:${'B'.repeat(43)}`,
        }),
      ),
    ).toBe(false);
  });

  it('rejects invalid timeSlot values', () => {
    expect(validate(validWire({ timeSlot: -1 }))).toBe(false);
    expect(validate(validWire({ timeSlot: 1.5 }))).toBe(false);
    expect(
      validate({ ...validWire(), timeSlot: '42' as unknown as number }),
    ).toBe(false);
  });

  it('rejects nonce with wrong length or charset', () => {
    expect(validate(validWire({ nonce: 'short' }))).toBe(false);
    expect(
      validate(validWire({ nonce: '11111111-1111-4111-8111-111111111111' })),
    ).toBe(false);
    expect(validate(validWire({ nonce: `${'A'.repeat(15)}-` }))).toBe(false);
  });

  it('rejects signature with invalid ES256 wire form', () => {
    expect(validate(validWire({ signature: 'short' }))).toBe(false);
    expect(
      validate(
        validWire({
          signature: `${'_'.repeat(ES256_SIGNATURE_BASE64_BODY_LENGTH)}==`,
        }),
      ),
    ).toBe(false);
    expect(
      validate(
        validWire({ signature: 'A'.repeat(ES256_SIGNATURE_BASE64_LENGTH) }),
      ),
    ).toBe(false);
  });
});

describe('authenticate header wire validation', () => {
  afterEach(() => {
    setAuthNonceStoreForTests(null);
  });

  async function mintNonce(keyId: string): Promise<string> {
    const store = createMemoryAuthNonceStore();
    setAuthNonceStoreForTests(store);
    const minted = await store.mint(keyId);
    return minted.nonce;
  }

  async function authorizedHeaders(
    overrides: Record<string, string> = {},
  ): Promise<Record<string, string>> {
    const material = await createTestMaterial();
    const nonce = await mintNonce(material.keyId);
    const timeSlot = computeAuthTimeSlot();
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce },
      { method: 'GET', path: '/api/probe', query: null },
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce,
      signature,
    });
    return { ...proof, ...overrides };
  }

  it('accepts valid auth headers before crypto checks succeed', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders();

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(200);
  });

  it('rejects missing auth headers without running route handler', async () => {
    const app = new Koa();
    app.use(errorHandler());
    let handlerReached = false;
    app.use(authenticate());
    app.use((ctx) => {
      handlerReached = true;
      ctx.body = { ok: true };
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers: {},
    });

    expect(response.status).toBe(401);
    expect(handlerReached).toBe(false);
  });

  it('rejects malformed publicKey wire before thumbprint verification', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders({
      [AUTH_HEADER_PUBLIC_KEY]: 'not-valid-coordinates',
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
    const body: { error?: string } = JSON.parse(response.body);
    expect(body.error).toMatch(/authentication headers/i);
  });

  it('rejects legacy UUID nonce wire before nonce store lookup', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders({
      [AUTH_HEADER_NONCE]: '11111111-1111-4111-8111-111111111111',
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
  });

  it('rejects invalid signature wire before verifyAuthProof', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders({
      [AUTH_HEADER_SIGNATURE]: 'not-a-valid-es256-signature',
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
  });

  it('rejects invalid keyId wire before thumbprint verification', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders({
      [AUTH_HEADER_KEY_ID]: 'not-a-valid-key-id',
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
  });

  it('rejects non-integer time slot wire before time-window check', async () => {
    const app = createAuthProbeApp();
    const headers = await authorizedHeaders({
      [AUTH_HEADER_TIME_SLOT]: '1.5',
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
  });

  it('rejects oversize publicKey values within node header limits', async () => {
    const app = createAuthProbeApp();
    const material = await createTestMaterial();
    const validPublicKey = formatAuthPublicKeyWire(material.publicKey);
    const headers = await authorizedHeaders({
      [AUTH_HEADER_PUBLIC_KEY]: `${validPublicKey}${'A'.repeat(256)}`,
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });

    expect(response.status).toBe(401);
  });
});

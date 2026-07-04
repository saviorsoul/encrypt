import { afterEach, describe, expect, it } from 'vitest';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import {
  AUTH_HEADER_KEY_ID,
  AUTH_HEADER_NEXT_NONCE,
  AUTH_HEADER_NEXT_NONCE_EXPIRES_AT,
  AUTH_HEADER_NONCE,
  AUTH_HEADER_PUBLIC_KEY,
  AUTH_HEADER_SIGNATURE,
  AUTH_HEADER_TIME_SLOT,
  authHeadersToRecord,
  computeAuthTimeSlot,
  formatAuthPublicKeyWire,
  signAuthProof,
} from '@encrypt/core/crypto/authProof';
import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { bytesToBase64 } from '@encrypt/core/utils/bytes';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { createApp } from '../app.js';
import { authenticate } from '../middleware/authenticate.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { createAuthRouter } from '../routes/auth.js';
import {
  createMemoryAuthNonceStore,
  setAuthNonceStoreForTests,
} from '../services/authNonce.js';
import { requestApp } from './requestApp.js';

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

describe('auth challenge and nonce rotation', () => {
  afterEach(() => {
    setAuthNonceStoreForTests(null);
  });

  it('bootstraps via challenge and rotates X-Next-Nonce', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const app = createAuthProbeApp();
    const material = await createTestMaterial();

    const challengeResponse = await requestApp(app, {
      method: 'POST',
      path: '/api/auth/challenge',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyId: material.keyId,
      }),
    });

    expect(challengeResponse.status).toBe(201);
    const challengeBody = JSON.parse(challengeResponse.body) as {
      nonce: string;
      expiresAt: number;
    };
    expect(challengeBody.nonce).toBeTruthy();
    expect(challengeBody.expiresAt).toBeGreaterThan(Date.now());

    const request = {
      method: 'GET',
      path: '/api/probe',
      query: null,
    };
    const timeSlot = computeAuthTimeSlot();
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: challengeBody.nonce },
      request,
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce: challengeBody.nonce,
      signature,
    });

    const firstResponse = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers: {
        [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
        [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
        [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
        [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
        [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
      },
    });

    expect(firstResponse.status).toBe(200);
    const nextNonce =
      firstResponse.headers[AUTH_HEADER_NEXT_NONCE.toLowerCase()];
    expect(nextNonce).toBeTruthy();
    expect(nextNonce).not.toBe(challengeBody.nonce);
    const nextNonceExpiresAt = Number(
      firstResponse.headers[AUTH_HEADER_NEXT_NONCE_EXPIRES_AT.toLowerCase()],
    );
    expect(nextNonceExpiresAt).toBeGreaterThan(Date.now());

    const secondSignature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: nextNonce! },
      request,
    );
    const secondProof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce: nextNonce!,
      signature: secondSignature,
    });

    const secondResponse = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers: {
        [AUTH_HEADER_KEY_ID]: secondProof[AUTH_HEADER_KEY_ID]!,
        [AUTH_HEADER_PUBLIC_KEY]: formatAuthPublicKeyWire(material.publicKey),
        [AUTH_HEADER_TIME_SLOT]: secondProof[AUTH_HEADER_TIME_SLOT]!,
        [AUTH_HEADER_NONCE]: secondProof[AUTH_HEADER_NONCE]!,
        [AUTH_HEADER_SIGNATURE]: secondProof[AUTH_HEADER_SIGNATURE]!,
      },
    });

    expect(secondResponse.status).toBe(200);
    expect(
      secondResponse.headers[AUTH_HEADER_NEXT_NONCE.toLowerCase()],
    ).toBeTruthy();
    expect(
      secondResponse.headers[AUTH_HEADER_NEXT_NONCE.toLowerCase()],
    ).not.toBe(nextNonce);
  });

  it('rejects replay of a consumed nonce', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const app = createAuthProbeApp();
    const material = await createTestMaterial();
    const store = createMemoryAuthNonceStore();
    setAuthNonceStoreForTests(store);
    const minted = await store.mint(material.keyId);

    const request = {
      method: 'GET',
      path: '/api/probe',
      query: null,
    };
    const timeSlot = computeAuthTimeSlot();
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: minted.nonce },
      request,
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce: minted.nonce,
      signature,
    });
    const headers = {
      [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
      [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
      [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
      [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
      [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
    };

    const first = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });
    expect(first.status).toBe(200);

    const replay = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers,
    });
    expect(replay.status).toBe(401);
  });

  it('exposes challenge on the full app router', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const material = await createTestMaterial();
    const response = await requestApp(createApp(), {
      method: 'POST',
      path: '/api/auth/challenge',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyId: material.keyId,
      }),
    });
    expect(response.status).toBe(201);
    const body = JSON.parse(response.body) as {
      nonce: string;
      expiresAt: number;
    };
    expect(body).toHaveProperty('nonce');
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects challenge requests without keyId', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const response = await requestApp(createAuthProbeApp(), {
      method: 'POST',
      path: '/api/auth/challenge',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('reuses an existing nonce on repeated challenge requests', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const app = createAuthProbeApp();
    const material = await createTestMaterial();

    const firstChallenge = await requestApp(app, {
      method: 'POST',
      path: '/api/auth/challenge',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyId: material.keyId }),
    });
    const firstNonce = (JSON.parse(firstChallenge.body) as { nonce: string })
      .nonce;

    const secondChallenge = await requestApp(app, {
      method: 'POST',
      path: '/api/auth/challenge',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keyId: material.keyId }),
    });
    const secondNonce = (JSON.parse(secondChallenge.body) as { nonce: string })
      .nonce;
    const firstExpiresAt = (
      JSON.parse(firstChallenge.body) as { expiresAt: number }
    ).expiresAt;
    const secondExpiresAt = (
      JSON.parse(secondChallenge.body) as { expiresAt: number }
    ).expiresAt;

    expect(secondNonce).toBe(firstNonce);
    expect(secondExpiresAt).toBe(firstExpiresAt);

    const request = {
      method: 'GET',
      path: '/api/probe',
      query: null,
    };
    const timeSlot = computeAuthTimeSlot();
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce: firstNonce },
      request,
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce: firstNonce,
      signature,
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers: {
        [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
        [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
        [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
        [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
        [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
      },
    });

    expect(response.status).toBe(200);
  });

  it('rejects auth with a legacy UUID nonce header', async () => {
    setAuthNonceStoreForTests(createMemoryAuthNonceStore());
    const app = createAuthProbeApp();
    const material = await createTestMaterial();
    const request = {
      method: 'GET',
      path: '/api/probe',
      query: null,
    };
    const timeSlot = computeAuthTimeSlot();
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      {
        timeSlot,
        nonce: bytesToBase64(new Uint8Array(12).fill(0x33)),
      },
      request,
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce: bytesToBase64(new Uint8Array(12).fill(0x33)),
      signature,
    });

    const response = await requestApp(app, {
      method: 'GET',
      path: '/api/probe',
      headers: {
        [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
        [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
        [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
        [AUTH_HEADER_NONCE]: '11111111-1111-4111-8111-111111111111',
        [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
      },
    });

    expect(response.status).toBe(401);
  });
});

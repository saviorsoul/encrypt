import { afterEach, describe, expect, it, vi } from 'vitest';
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
  signAuthProof,
} from '@encrypt/core/crypto/authProof';
import { slimEcPrivateJwk } from '@encrypt/core/crypto/jwkThumbprint';
import { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { errorHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { registeredApiUnlessPublic } from '../middleware/registeredApiUnlessPublic.js';
import { requireRegisteredUser } from '../middleware/requireRegisteredUser.js';
import {
  createMemoryAuthNonceStore,
  setAuthNonceStoreForTests,
} from '@/contexts/auth/index.js';
import { requestApp } from './requestApp.js';

const userRepoMocks = vi.hoisted(() => ({
  findRegisteredKeyIds: vi.fn(),
  register: vi.fn(),
  registerIfAbsent: vi.fn(),
  exists: vi.fn(),
  findPublicKeysByKeyIds: vi.fn(),
}));

vi.mock('@/contexts/users/infrastructure/prismaUserRepository.js', () => ({
  userRepository: userRepoMocks,
}));

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

function createRegisteredGateProbeApp(): Koa {
  const app = new Koa();
  app.use(errorHandler());
  app.use(bodyParser());
  app.use(authenticate());
  app.use(registeredApiUnlessPublic(requireRegisteredUser()));
  app.use((ctx) => {
    ctx.body = { ok: true };
  });
  return app;
}

async function mintNonce(keyId: string): Promise<string> {
  const nonceStore = createMemoryAuthNonceStore();
  setAuthNonceStoreForTests(nonceStore);
  const challenge = await nonceStore.getOrMint(keyId);
  return challenge.nonce;
}

async function authorizedGet(
  app: Koa,
  path: string,
  material: Awaited<ReturnType<typeof createTestMaterial>>,
  nonce: string,
) {
  const request = { method: 'GET', path, query: null };
  const timeSlot = computeAuthTimeSlot();
  const signature = await signAuthProof(
    material.ecdsaSignPrivateKey,
    material.keyId,
    { timeSlot, nonce },
    request,
  );
  const proof = authHeadersToRecord({
    keyId: material.keyId,
    publicKey: material.publicKey,
    timeSlot,
    nonce,
    signature,
  });
  return requestApp(app, {
    method: 'GET',
    path,
    headers: {
      [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
      [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
      [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
      [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
      [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
    },
  });
}

describe('registered user gate middleware', () => {
  afterEach(() => {
    setAuthNonceStoreForTests(null);
    vi.clearAllMocks();
  });

  it('returns 400 for authenticated but unregistered key on protected routes', async () => {
    const app = createRegisteredGateProbeApp();
    const material = await createTestMaterial();
    userRepoMocks.findRegisteredKeyIds.mockResolvedValue(new Set());
    const nonce = await mintNonce(material.keyId);

    const response = await authorizedGet(app, '/api/inbox', material, nonce);

    expect(response.status).toBe(400);
    expect(response.body).toContain(`Unknown user keyId: ${material.keyId}`);
  });

  it('allows registered key through protected routes', async () => {
    const app = createRegisteredGateProbeApp();
    const material = await createTestMaterial();
    userRepoMocks.findRegisteredKeyIds.mockResolvedValue(
      new Set([material.keyId]),
    );
    const nonce = await mintNonce(material.keyId);

    const response = await authorizedGet(app, '/api/inbox', material, nonce);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('skips registration gate for invitation accept (auth-only)', async () => {
    const app = createRegisteredGateProbeApp();
    const material = await createTestMaterial();
    userRepoMocks.findRegisteredKeyIds.mockResolvedValue(new Set());
    const nonce = await mintNonce(material.keyId);

    const timeSlot = computeAuthTimeSlot();
    const path = '/api/friend-invitations/test-token/accept';
    const request = {
      method: 'POST',
      path,
      query: null,
      body: {},
    };
    const signature = await signAuthProof(
      material.ecdsaSignPrivateKey,
      material.keyId,
      { timeSlot, nonce },
      request,
    );
    const proof = authHeadersToRecord({
      keyId: material.keyId,
      publicKey: material.publicKey,
      timeSlot,
      nonce,
      signature,
    });

    const response = await requestApp(app, {
      method: 'POST',
      path,
      headers: {
        [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
        [AUTH_HEADER_PUBLIC_KEY]: proof[AUTH_HEADER_PUBLIC_KEY]!,
        [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
        [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
        [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(userRepoMocks.findRegisteredKeyIds).not.toHaveBeenCalled();
  });
});

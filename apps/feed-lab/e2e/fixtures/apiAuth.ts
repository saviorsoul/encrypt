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
  COMMENT_VERSION,
  COMMENT_WRAP,
} from '@encrypt/core/crypto/commentConstants';
import { MANIFEST_WRAP } from '@encrypt/core/constants/manifestConstants';
import {
  MANIFEST_SHARE_VERSION,
  MANIFEST_SHARE_WRAP,
} from '@encrypt/core/constants/manifestShare';
import type { importUploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { ES256_SIGNATURE_BASE64_BODY_LENGTH } from '@encrypt/core/crypto/es256Constants';
import { API_BASE_URL } from './apiStack.ts';

/** Schema-valid ES256 signature placeholder (length + alphabet; not a real signature). */
const PLACEHOLDER_ES256_SIGNATURE =
  'A'.repeat(ES256_SIGNATURE_BASE64_BODY_LENGTH) + '==';

type TestKeyMaterial = Awaited<
  ReturnType<typeof importUploadedPrivateKeyMaterial>
>;

/** Placeholder thread id for schema-valid feed payloads in negative API tests. */
export const E2E_PLACEHOLDER_MESSAGE_ID =
  '00000000-0000-4000-8000-000000000001';

function senderPublicJwkFromMaterial(
  material: TestKeyMaterial,
): Record<string, unknown> {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: material.publicKey.x,
    y: material.publicKey.y,
  };
}

function keyManifestShardForKey(keyId: string): Record<string, unknown> {
  return {
    keyId,
    iv: 'AAAAAAAAAAAA',
    salt: 'AAAAAAAAAAAA',
    encryptedDek: 'dek-with-known-material',
  };
}

export async function mintAuthNonce(keyId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyId }),
  });
  if (!response.ok) {
    throw new Error(`Auth challenge failed (${response.status}).`);
  }
  const body = (await response.json()) as { nonce?: string };
  if (!body.nonce) {
    throw new Error('Auth challenge response missing nonce.');
  }
  return body.nonce;
}

export async function authorizedApiRequest(options: {
  material: TestKeyMaterial;
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): Promise<{ status: number; body: string }> {
  const { material, method, path, body } = options;
  const nonce = await mintAuthNonce(material.keyId);
  const timeSlot = computeAuthTimeSlot();
  const requestDescriptor =
    body === undefined
      ? { method, path, query: null }
      : { method, path, query: null, body };
  const signature = await signAuthProof(
    material.ecdsaSignPrivateKey,
    material.keyId,
    { timeSlot, nonce },
    requestDescriptor,
  );
  const proof = authHeadersToRecord({
    keyId: material.keyId,
    publicKey: material.publicKey,
    timeSlot,
    nonce,
    signature,
  });

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      [AUTH_HEADER_KEY_ID]: proof[AUTH_HEADER_KEY_ID]!,
      [AUTH_HEADER_PUBLIC_KEY]: formatAuthPublicKeyWire(material.publicKey),
      [AUTH_HEADER_TIME_SLOT]: proof[AUTH_HEADER_TIME_SLOT]!,
      [AUTH_HEADER_NONCE]: proof[AUTH_HEADER_NONCE]!,
      [AUTH_HEADER_SIGNATURE]: proof[AUTH_HEADER_SIGNATURE]!,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

/** Schema-valid create-message body (would succeed if the actor were registered). */
export function buildMinimalCreateMessageBody(
  keyId: string,
  material?: TestKeyMaterial,
): Record<string, unknown> {
  const senderPublicJwk = material
    ? senderPublicJwkFromMaterial(material)
    : {
        kty: 'EC',
        crv: 'P-256',
        x: 'x',
        y: 'y',
      };

  return {
    version: 9,
    wrap: MANIFEST_WRAP,
    senderPublicJwk,
    ephemeralPublicKey: senderPublicJwk,
    encryptedContent: {
      iv: 'AAAAAAAAAAAA',
      ciphertext: 'ciphertext',
    },
    senderSignature: PLACEHOLDER_ES256_SIGNATURE,
    keyManifest: {
      [keyId]: keyManifestShardForKey(keyId),
    },
  };
}

/** Schema-valid comment body (message-bound ciphertext; blocked when actor is unregistered). */
export function buildMinimalCommentBody(
  material: TestKeyMaterial,
  messageId = E2E_PLACEHOLDER_MESSAGE_ID,
): Record<string, unknown> {
  return {
    version: COMMENT_VERSION,
    wrap: COMMENT_WRAP,
    messageId,
    senderPublicJwk: senderPublicJwkFromMaterial(material),
    salt: 'AAAAAAAAAAAA',
    encryptedContent: {
      iv: 'AAAAAAAAAAAA',
      ciphertext: 'comment-ciphertext',
    },
    senderSignature: PLACEHOLDER_ES256_SIGNATURE,
  };
}

/** Schema-valid share body (key manifest with DEK shard; blocked when actor is unregistered). */
export function buildMinimalShareBody(
  material: TestKeyMaterial,
  options?: {
    parentMessageId?: string;
    recipientKeyId?: string;
  },
): Record<string, unknown> {
  const parentMessageId =
    options?.parentMessageId ?? E2E_PLACEHOLDER_MESSAGE_ID;
  const recipientKeyId = options?.recipientKeyId ?? material.keyId;
  const sharerPublicJwk = senderPublicJwkFromMaterial(material);

  return {
    share: {
      version: MANIFEST_SHARE_VERSION,
      wrap: MANIFEST_SHARE_WRAP,
      parentMessageId,
      sharerPublicJwk,
      ephemeralPublicKey: sharerPublicJwk,
      sharerSignature: PLACEHOLDER_ES256_SIGNATURE,
    },
    keyManifest: {
      [recipientKeyId]: keyManifestShardForKey(recipientKeyId),
    },
  };
}

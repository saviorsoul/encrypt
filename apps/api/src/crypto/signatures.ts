import { base64ToBytes } from './bytes.js';
import { importPublicKeyForEcdsaVerify } from './ecdsaKeys.js';

/** Deterministic UTF-8 bytes for signing — canonical JSON with explicit property order. */
export function serializeForSigning(
  canonical: Record<string, unknown>,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(canonical));
}

async function verifyCanonicalSignature(
  senderPublicJwk: JsonWebKey,
  senderSignature: string,
  signableCanonical: Record<string, unknown>,
  failureMessage: string,
): Promise<void> {
  if (!senderSignature) {
    throw new Error('Missing signature in payload.');
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64ToBytes(senderSignature);
  } catch {
    throw new Error('Invalid signature encoding (expected Base64).');
  }

  const verifyKey = await importPublicKeyForEcdsaVerify(senderPublicJwk);
  const signableBytes = serializeForSigning(signableCanonical);

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verifyKey,
    new Uint8Array(signatureBytes),
    signableBytes,
  );

  if (!valid) {
    throw new Error(failureMessage);
  }
}

type ManifestSignableBody = {
  version: number;
  wrap: string;
  senderPublicJwk: JsonWebKey;
  ephemeralPublicKey: JsonWebKey;
  encryptedContent: {
    iv: string;
    ciphertext: string;
  };
};

type ManifestPayload = ManifestSignableBody & {
  senderSignature: string;
};

function manifestSignableBodyForSigning(
  body: ManifestSignableBody,
): Record<string, unknown> {
  return {
    version: body.version,
    wrap: body.wrap,
    senderPublicJwk: body.senderPublicJwk,
    ephemeralPublicKey: body.ephemeralPublicKey,
    encryptedContent: body.encryptedContent,
  };
}

export async function verifyManifestSignature(
  payload: ManifestPayload,
): Promise<void> {
  const { senderSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.senderPublicJwk,
    senderSignature,
    manifestSignableBodyForSigning(signableBody),
    'Sender signature verification failed (payload may have been tampered with).',
  );
}

type ManifestShareSignableBody = {
  version: number;
  wrap: string;
  parentMessageId: string;
  sharerPublicJwk: JsonWebKey;
  ephemeralPublicKey: JsonWebKey;
};

type ManifestShareWirePayload = ManifestShareSignableBody & {
  sharerSignature: string;
};

function manifestShareSignableBodyForSigning(
  body: ManifestShareSignableBody,
): Record<string, unknown> {
  return {
    version: body.version,
    wrap: body.wrap,
    parentMessageId: body.parentMessageId,
    sharerPublicJwk: body.sharerPublicJwk,
    ephemeralPublicKey: body.ephemeralPublicKey,
  };
}

export async function verifyManifestShareSignature(
  payload: ManifestShareWirePayload,
): Promise<void> {
  const { sharerSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.sharerPublicJwk,
    sharerSignature,
    manifestShareSignableBodyForSigning(signableBody),
    'Share signature verification failed (payload may have been tampered with).',
  );
}

type CommentSignableBody = {
  version: number;
  wrap: string;
  messageId: string;
  senderPublicJwk: JsonWebKey;
  salt: string;
  encryptedContent: {
    iv: string;
    ciphertext: string;
  };
};

type CommentPayload = CommentSignableBody & {
  senderSignature: string;
};

export async function verifyCommentSignature(
  payload: CommentPayload,
): Promise<void> {
  const { senderSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.senderPublicJwk,
    senderSignature,
    signableBody,
    'Comment signature verification failed (payload may have been tampered with).',
  );
}

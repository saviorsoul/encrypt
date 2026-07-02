import { base64ToBytes, bytesToBase64 } from '../utils/bytes.ts';
import { importPublicKeyForEcdsaVerify } from '../crypto/ecdsaKeys.ts';
import type {
  ManifestCorePayload,
  ManifestPayload,
  ManifestAssembly,
  ManifestSignableBody,
} from '../types/manifest.ts';

/** Deterministic UTF-8 bytes for signing — canonical JSON with explicit property order. */
export function serializeForSigning(
  canonical: Record<string, unknown>,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(canonical));
}

export async function signCanonicalBody(
  senderSigningPrivateKey: CryptoKey,
  signableCanonical: Record<string, unknown>,
): Promise<string> {
  const signableBytes = serializeForSigning(signableCanonical);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    senderSigningPrivateKey,
    signableBytes,
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyCanonicalSignature(
  senderPublicJwk: JsonWebKey,
  senderSignature: string,
  signableCanonical: Record<string, unknown>,
  failureMessage = 'Sender signature verification failed (payload may have been tampered with).',
): Promise<void> {
  if (!senderSignature) {
    throw new Error('Missing senderSignature in payload (invalid manifest).');
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64ToBytes(senderSignature);
  } catch {
    throw new Error('Invalid senderSignature encoding (expected Base64).');
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

export function manifestSignableBodyForSigning(
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

export async function signManifestBody(
  senderSigningPrivateKey: CryptoKey,
  body: ManifestSignableBody | ManifestAssembly,
): Promise<string> {
  return signCanonicalBody(
    senderSigningPrivateKey,
    manifestSignableBodyForSigning(body),
  );
}
export async function verifyManifestSignature(
  payload: ManifestPayload | ManifestCorePayload,
): Promise<void> {
  const { senderSignature, ...signableBody } = payload;
  await verifyCanonicalSignature(
    payload.senderPublicJwk,
    senderSignature,
    manifestSignableBodyForSigning(signableBody),
  );
}

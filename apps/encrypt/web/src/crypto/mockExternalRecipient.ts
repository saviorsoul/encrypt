import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';

/** Demo-only: full mock peer row including private key for local DEK decrypt (not part of encrypt types). */
export type MockExternalRecipientMaterial = ManifestRecipientKeys & {
  privateKey: CryptoKey;
};

/**
 * Dev/test helper: another user's ECDH P-256 key pair, compatible with manifest v3 KEK/DEK flow.
 * Public fields build keyManifest entries; private key decrypts payloads addressed to this mock user.
 */
export async function createMockExternalRecipient(): Promise<MockExternalRecipientMaterial> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

  const keyId = await ecPublicJwkThumbprintSha256(jwk);

  return {
    keyId,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

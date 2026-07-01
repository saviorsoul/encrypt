import { importPublicKeyExtractable } from '@encrypt/core/crypto/ecdhKeys';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';

export async function manifestRecipientFromJwk(
  jwk: JsonWebKey,
): Promise<ManifestRecipientKeys> {
  const slimJwk = slimEcPublicJwk(jwk);
  const [keyId, publicKey] = await Promise.all([
    ecPublicJwkThumbprintSha256(slimJwk),
    importPublicKeyExtractable(slimJwk),
  ]);
  return { keyId, publicKey };
}

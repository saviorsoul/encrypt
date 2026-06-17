import { importPrivateKeyNonExtractable } from '@/crypto/ecdhKeys.ts';
import { importPrivateKeyForEcdsaSign } from '@/crypto/ecdsaKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';

export type UploadedPrivateKeyMaterial = {
  keyId: string;
  ecdhPrivateKey: CryptoKey;
  ecdsaSignPrivateKey: CryptoKey;
};

export async function importUploadedPrivateKeyMaterial(
  jwk: JsonWebKey,
): Promise<UploadedPrivateKeyMaterial> {
  const keyId = await ecPublicJwkThumbprintSha256(slimEcPublicJwk(jwk));
  const [ecdhPrivateKey, ecdsaSignPrivateKey] = await Promise.all([
    importPrivateKeyNonExtractable(jwk),
    importPrivateKeyForEcdsaSign(jwk),
  ]);

  return { keyId, ecdhPrivateKey, ecdsaSignPrivateKey };
}

export function assertUploadedPrivateKeyMatchesKeyId(
  material: UploadedPrivateKeyMaterial,
  expectedKeyId: string,
  message = 'Uploaded private key does not match the publicKeyJwk for this side.',
): void {
  if (material.keyId !== expectedKeyId) {
    throw new Error(message);
  }
}

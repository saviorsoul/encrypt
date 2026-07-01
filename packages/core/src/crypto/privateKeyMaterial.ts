import {
  importPrivateKeyNonExtractable,
  importPublicKeyExtractable,
} from '../crypto/ecdhKeys.ts';
import { importPrivateKeyForEcdsaSign } from '../crypto/ecdsaKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '../crypto/jwkThumbprint.ts';

export type UploadedPrivateKeyMaterial = {
  keyId: string;
  ecdhPrivateKey: CryptoKey;
  ecdsaSignPrivateKey: CryptoKey;
  /** Extractable ECDH public key (from JWK x/y at import; not via exportKey on private key). */
  senderPublicKey: CryptoKey;
};

export async function importUploadedPrivateKeyMaterial(
  jwk: JsonWebKey,
): Promise<UploadedPrivateKeyMaterial> {
  const publicJwk = slimEcPublicJwk(jwk);
  const keyId = await ecPublicJwkThumbprintSha256(publicJwk);
  const [ecdhPrivateKey, ecdsaSignPrivateKey, senderPublicKey] =
    await Promise.all([
      importPrivateKeyNonExtractable(jwk),
      importPrivateKeyForEcdsaSign(jwk),
      importPublicKeyExtractable(publicJwk),
    ]);

  return { keyId, ecdhPrivateKey, ecdsaSignPrivateKey, senderPublicKey };
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

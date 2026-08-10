import type { AuthPublicKeyCoords } from '@encrypt/core/crypto/authProof';

let authKeyId: string | null = null;
let authPublicKey: AuthPublicKeyCoords | null = null;

export function syncSystemAppAuthSession(
  keyId: string | null,
  publicKey: AuthPublicKeyCoords | null,
): void {
  authKeyId = keyId;
  authPublicKey = publicKey;
}

export function getSystemAppAuthKeyId(): string | null {
  return authKeyId;
}

export function getSystemAppAuthPublicKey(): AuthPublicKeyCoords | null {
  return authPublicKey;
}

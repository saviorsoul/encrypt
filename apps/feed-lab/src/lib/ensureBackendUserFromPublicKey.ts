import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { FeedApi } from '@encrypt/core/api/feedApi';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';

export type EnsureBackendUserResult =
  | {
      ok: true;
      keyId: string;
      publicKey: { x: string; y: string };
      createdOnBackend: boolean;
    }
  | { ok: false; error: string };

function isUserAlreadyExistsError(message: string): boolean {
  return message.startsWith('User already exists');
}

export async function ensureBackendUserFromPublicKey(
  api: FeedApi,
  publicKeyText: string,
): Promise<EnsureBackendUserResult> {
  const trimmed = publicKeyText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a public key.' };
  }

  const parsed = parsePublicKeyText(trimmed);
  if (parsed.ok === false) {
    return { ok: false, error: parsed.error };
  }

  const slimJwk = slimEcPublicJwk(parsed.jwk);
  const x = slimJwk.x;
  const y = slimJwk.y;
  if (!x || !y) {
    return { ok: false, error: 'Public key must include x and y.' };
  }

  const keyId = await ecPublicJwkThumbprintSha256(slimJwk);
  const publicKey = { x, y };

  try {
    await api.postUser({ publicKey });
    return { ok: true, keyId, publicKey, createdOnBackend: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to register user.';
    if (!isUserAlreadyExistsError(message)) {
      return { ok: false, error: message };
    }
    return { ok: true, keyId, publicKey, createdOnBackend: false };
  }
}

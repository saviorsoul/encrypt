import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { FeedApi, FeedApiRequestOptions } from '@encrypt/core/api/feedApi';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';

export type EnsureBackendUserResult =
  | {
      ok: true;
      keyId: string;
      publicKey: { x: string; y: string };
    }
  | { ok: false; error: string };

export async function ensureBackendUserFromPublicKey(
  api: FeedApi,
  publicKeyText: string,
  options?: FeedApiRequestOptions,
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

  const users = await api.getUsers(options);
  if (!users.some((user) => user.keyId === keyId)) {
    return {
      ok: false,
      error:
        'This person must join via an invitation link before you can send a request.',
    };
  }

  return { ok: true, keyId, publicKey };
}

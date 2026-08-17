import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@encrypt/core/crypto/jwkThumbprint';
import type { FeedApi } from '@encrypt/core/api/feedApi';
import { parsePublicKeyText } from '@encrypt/core/utils/parsePublicKeyText';

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

  return { ok: true, keyId, publicKey };
}

import { parsePrivateKeyJwkText } from '@/crypto/privateKeyFile.ts';
import { parsePublicKeyText } from '@/utils/parsePublicKeyText.ts';
import { parseManifestPayloadText } from '@/utils/parseManifestPayloadText.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';
import { validateImportJsonText } from '@/utils/readImportJsonFile.ts';

export type ClassifiedExternalJson =
  | { kind: 'message'; text: string }
  | { kind: 'privateKey'; text: string; jwk: JsonWebKey }
  | { kind: 'publicKey'; text: string; jwk: JsonWebKey }
  | { kind: 'invalid'; error: string };

function isEcJwkRoot(parsed: Record<string, unknown>): boolean {
  return (
    parsed.kty === 'EC' ||
    (typeof parsed.x === 'string' && typeof parsed.y === 'string')
  );
}

function hasPrivateComponent(parsed: Record<string, unknown>): boolean {
  const d = parsed.d;
  return typeof d === 'string' && d.length > 0;
}

/**
 * Detect whether external JSON is an encrypted message, private key JWK,
 * or public key JWK. All inputs must pass base JSON validation first.
 */
export function classifyExternalJsonText(text: string): ClassifiedExternalJson {
  const base = validateBaseJsonText(text);
  if (base.ok === false) {
    return { kind: 'invalid', error: base.error };
  }

  if (isEcJwkRoot(base.parsed)) {
    if (hasPrivateComponent(base.parsed)) {
      const privateKey = parsePrivateKeyJwkText(base.text);
      if (privateKey.ok) {
        return {
          kind: 'privateKey',
          text: base.text,
          jwk: privateKey.jwk,
        };
      }
      if (privateKey.ok === false) {
        return { kind: 'invalid', error: privateKey.error };
      }
    }

    const publicKey = parsePublicKeyText(base.text);
    if (publicKey.ok) {
      return {
        kind: 'publicKey',
        text: base.text,
        jwk: publicKey.jwk,
      };
    }
    if (publicKey.ok === false) {
      return { kind: 'invalid', error: publicKey.error };
    }
  }

  const message = validateImportJsonText(base.text);
  if (message.ok) {
    return { kind: 'message', text: message.text };
  }

  const manifest = parseManifestPayloadText(base.text);
  if (manifest.ok) {
    return { kind: 'message', text: base.text };
  }

  if (message.ok === false) {
    return { kind: 'invalid', error: message.error };
  }

  return { kind: 'invalid', error: 'Unrecognized JSON file.' };
}

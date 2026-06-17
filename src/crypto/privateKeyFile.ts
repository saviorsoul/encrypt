import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import {
  cachePrivateKeyMaterial,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  importUploadedPrivateKeyMaterial,
  type UploadedPrivateKeyMaterial,
} from '@/crypto/privateKeyMaterial.ts';

const FILE_SELECTION_CANCELLED = 'No private key file selected.';

export type ParsePrivateKeyJwkResult =
  | { ok: true; jwk: JsonWebKey }
  | { ok: false; error: string };

function parsePrivateKeyJwk(text: string): JsonWebKey {
  const parsed = parsePrivateKeyJwkText(text);
  if (parsed.ok === false) {
    throw new Error(parsed.error);
  }
  return parsed.jwk;
}

/** Parse and syntactically validate an EC P-256 private JWK from JSON text. */
export function parsePrivateKeyJwkText(text: string): ParsePrivateKeyJwkResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Private key file is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'Private key file is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Private key file must contain a JWK object.' };
  }

  try {
    return { ok: true, jwk: slimEcPrivateJwk(parsed as JsonWebKey) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid private key JWK.';
    return { ok: false, error: message };
  }
}

export async function readPrivateKeyJwkFromFile(
  file: File,
): Promise<JsonWebKey> {
  const text = await file.text();
  return readPrivateKeyJwkFromText(text);
}

export function readPrivateKeyJwkFromText(text: string): JsonWebKey {
  return parsePrivateKeyJwk(text);
}

/** Open the browser file picker for a private-key JWK file. */
export function pickPrivateKeyJwkFile(): Promise<JsonWebKey> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jwk,.json,application/json';
    input.style.display = 'none';

    let settled = false;

    const rejectCancelled = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(FILE_SELECTION_CANCELLED));
    };

    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
    };

    const onChange = () => {
      const file = input.files?.[0];
      if (!file) {
        rejectCancelled();
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      void readPrivateKeyJwkFromFile(file).then(resolve, reject);
    };

    const onCancel = () => {
      rejectCancelled();
    };

    const onWindowFocus = () => {
      // Fallback for browsers without `cancel` on <input type="file">.
      window.setTimeout(() => {
        if (!input.files?.length) {
          rejectCancelled();
        }
      }, 500);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    window.addEventListener('focus', onWindowFocus, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

export function isPrivateKeyFileSelectionCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === FILE_SELECTION_CANCELLED;
}

/**
 * Prompt for a private-key JWK file, import non-extractable CryptoKeys, run `fn`.
 * When caching is enabled, imported keys are kept in memory only for reuse in this tab.
 * Raw JWK material is not persisted.
 */
export async function withUploadedPrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T> {
  const cached = getCachedPrivateKeyMaterial();
  if (cached) {
    return fn(cached);
  }

  const jwk = await pickPrivateKeyJwkFile();
  const material = await importUploadedPrivateKeyMaterial(jwk);
  cachePrivateKeyMaterial(material);
  return fn(material);
}

import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import {
  cachePrivateKeyMaterial,
  getCachedPrivateKeyMaterial,
} from '@/crypto/sessionPrivateKeyStorage.ts';
import {
  importUploadedPrivateKeyMaterial,
  type UploadedPrivateKeyMaterial,
} from '@/crypto/privateKeyMaterial.ts';
import { validateBaseJsonText } from '@/utils/validateBaseJsonText.ts';

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
  const base = validateBaseJsonText(text);
  if (base.ok === false) {
    return { ok: false, error: base.error };
  }

  try {
    return { ok: true, jwk: slimEcPrivateJwk(base.parsed as JsonWebKey) };
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

export type PickedPrivateKeyJwkFile = {
  jwk: JsonWebKey;
  fileName: string;
};

/** Open the browser file picker for a private-key JWK file. */
export function pickPrivateKeyJwkFileWithName(): Promise<PickedPrivateKeyJwkFile> {
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
      void readPrivateKeyJwkFromFile(file).then(
        (jwk) => resolve({ jwk, fileName: file.name }),
        reject,
      );
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

/** Open the browser file picker for a private-key JWK file. */
export function pickPrivateKeyJwkFile(): Promise<JsonWebKey> {
  return pickPrivateKeyJwkFileWithName().then((picked) => picked.jwk);
}

export function isPrivateKeyFileSelectionCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === FILE_SELECTION_CANCELLED;
}

/** Open Electron's native private-key file dialog (works without renderer user activation). */
export async function pickPrivateKeyJwkInElectronNativeDialog(): Promise<JsonWebKey> {
  if (!window.electron?.pickPrivateKeyJwkText) {
    throw new Error('Native private key picker is not available.');
  }

  const result = await window.electron.pickPrivateKeyJwkText();
  if (result.cancelled) {
    throw new Error(FILE_SELECTION_CANCELLED);
  }
  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.text) {
    throw new Error('Private key file was empty.');
  }
  return readPrivateKeyJwkFromText(result.text);
}

/**
 * Prompt for a private-key JWK file, import non-extractable CryptoKeys, run `fn`.
 * When caching is enabled, imported keys are kept in memory only for reuse in this tab.
 * Raw JWK material is not persisted.
 */
export async function withUploadedPrivateKey<T>(
  fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
  options?: { pickJwk?: () => Promise<JsonWebKey> },
): Promise<T> {
  const cached = getCachedPrivateKeyMaterial();
  if (cached) {
    return fn(cached);
  }

  const jwk = options?.pickJwk
    ? await options.pickJwk()
    : await pickPrivateKeyJwkFile();
  const material = await importUploadedPrivateKeyMaterial(jwk);
  cachePrivateKeyMaterial(material);
  return fn(material);
}

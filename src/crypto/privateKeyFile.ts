import { slimEcPrivateJwk } from '@/crypto/jwkThumbprint.ts';
import { importPrivateKeyNonExtractable } from '@/crypto/ecdhKeys.ts';

const FILE_SELECTION_CANCELLED = 'No private key file selected.';

function parsePrivateKeyJwk(text: string): JsonWebKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Private key file is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Private key file must contain a JWK object.');
  }

  return slimEcPrivateJwk(parsed as JsonWebKey);
}

export async function readPrivateKeyJwkFromFile(
  file: File,
): Promise<JsonWebKey> {
  const text = await file.text();
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
 * Prompt for a private-key JWK file, import it, run `fn`, then drop the key reference.
 * The private key is never stored in app state or IndexedDB.
 */
export async function withUploadedPrivateKey<T>(
  fn: (privateKey: CryptoKey, jwk: JsonWebKey) => Promise<T>,
): Promise<T> {
  const jwk = await pickPrivateKeyJwkFile();
  const privateKey = await importPrivateKeyNonExtractable(jwk);
  return fn(privateKey, jwk);
}

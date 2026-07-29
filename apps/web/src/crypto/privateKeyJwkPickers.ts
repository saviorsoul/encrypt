import { readPrivateKeyJwkFromText } from '@/crypto/privateKeyJwkText.ts';

export const FILE_SELECTION_CANCELLED = 'No private key file selected.';

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
      void file.text().then(
        (text) =>
          resolve({
            jwk: readPrivateKeyJwkFromText(text),
            fileName: file.name,
          }),
        reject,
      );
    };

    const onCancel = () => {
      rejectCancelled();
    };

    const onWindowFocus = () => {
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

import { readPrivateKeyJwkFromText } from './privateKeyJwkText.ts';

export const FILE_SELECTION_CANCELLED = 'No private key file selected.';

export type PickedPrivateKeyJwkFile = {
  jwk: JsonWebKey;
  fileName: string;
};

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

export function pickPrivateKeyJwkFile(): Promise<JsonWebKey> {
  return pickPrivateKeyJwkFileWithName().then((picked) => picked.jwk);
}

export async function pickPrivateKeyJwkInElectronNativeDialog(): Promise<JsonWebKey> {
  const pickPrivateKeyJwkText = (
    window as Window & {
      electron?: {
        pickPrivateKeyJwkText?: () => Promise<{
          cancelled?: boolean;
          error?: string;
          text?: string;
        }>;
      };
    }
  ).electron?.pickPrivateKeyJwkText;

  if (!pickPrivateKeyJwkText) {
    throw new Error('Native private key picker is not available.');
  }

  const result = await pickPrivateKeyJwkText();
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

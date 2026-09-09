import { saveTextFileWithConfirmation } from '../utils/downloadJson.ts';
import { privateKeyDownloadFilename } from '../utils/privateKeyFilename.ts';
import {
  exportPublicKeyJwk,
  generateExtractableEcdhKeyPair,
  jwkWithoutKeyOps,
} from './ecdhKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPrivateJwk,
  slimEcPublicJwk,
} from './jwkThumbprint.ts';

export type PrivateKeyDownloadResult = {
  keyId: string;
  outcome: 'saved' | 'started';
  message: string;
};

export async function generatePrivateKeyDownloadFile(
  username: string,
): Promise<PrivateKeyDownloadResult> {
  const trimmedName = username.trim();
  if (!trimmedName) {
    throw new Error('Enter a username for the key file.');
  }

  const filename = privateKeyDownloadFilename(trimmedName);
  let keyId = '';

  const saveResult = await saveTextFileWithConfirmation(filename, async () => {
    const keyPair = await generateExtractableEcdhKeyPair();
    const privateJwk = slimEcPrivateJwk(
      (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey,
    );
    const publicJwk = await exportPublicKeyJwk(keyPair);
    keyId = await ecPublicJwkThumbprintSha256(slimEcPublicJwk(publicJwk));
    return JSON.stringify(jwkWithoutKeyOps(privateJwk), null, 2);
  });

  return { keyId, ...saveResult };
}

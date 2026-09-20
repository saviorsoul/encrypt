import { resolveMessageSideFromManifestSender } from '@/crypto/oneToOneManifest.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import {
  decryptWithManifest,
  parseManifestPayload,
} from '@/crypto/manifestDecrypt.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import { logError } from '@/utils/logError.ts';
import type {
  OneToOneThreadItem,
  PartyKeyIds,
  ThreadSide,
} from '@/types/oneToOne.ts';

export type DecryptedOneToOnePayload = {
  text: string;
  side: ThreadSide;
  manifestSenderKeyId: string;
};

export type OneToOneDecryptionResult = {
  text: string | null;
  error: string | null;
};

async function decryptOneToOnePayloadWithPrivateKey(
  encryptedPayload: string,
  partyKeyIds: PartyKeyIds,
  privateKey: CryptoKey,
  uploadedKeyId: string,
): Promise<DecryptedOneToOnePayload> {
  const { senderKeyId, recipientKeyId } = partyKeyIds;
  const manifest = parseManifestPayload(encryptedPayload);

  if (!manifest.keyManifest[uploadedKeyId]) {
    throw new Error(
      'Uploaded private key is not listed in this payload keyManifest.',
    );
  }

  if (uploadedKeyId !== senderKeyId && uploadedKeyId !== recipientKeyId) {
    throw new Error(
      'Uploaded private key does not match the sender or recipient publicKeyJwk.',
    );
  }

  const side = await resolveMessageSideFromManifestSender(
    manifest,
    senderKeyId,
    recipientKeyId,
  );
  const text = await decryptWithManifest(
    encryptedPayload,
    privateKey,
    uploadedKeyId,
  );
  const manifestSenderKeyId = await ecPublicJwkThumbprintSha256(
    slimEcPublicJwk(manifest.senderPublicJwk),
  );

  return { text, side, manifestSenderKeyId };
}

export async function decryptOneToOnePayload(
  encryptedPayload: string,
  partyKeyIds: PartyKeyIds,
): Promise<DecryptedOneToOnePayload> {
  return withUploadedPrivateKey(async (material) => {
    return decryptOneToOnePayloadWithPrivateKey(
      encryptedPayload,
      partyKeyIds,
      material.ecdhPrivateKey,
      material.keyId,
    );
  });
}

export async function decryptOneToOneThreadItemsWithUploadedPrivateKey(
  items: OneToOneThreadItem[],
  partyKeyIds: PartyKeyIds,
): Promise<Record<string, OneToOneDecryptionResult>> {
  return withUploadedPrivateKey(async (material) => {
    const results: Record<string, OneToOneDecryptionResult> = {};

    for (const item of items) {
      try {
        const { text } = await decryptOneToOnePayloadWithPrivateKey(
          item.encryptedPayload,
          partyKeyIds,
          material.ecdhPrivateKey,
          material.keyId,
        );
        results[item.id] = { text, error: null };
      } catch (e) {
        logError('decryptOneToOneThreadItemsWithUploadedPrivateKey', e, {
          messageId: item.id,
        });
        results[item.id] = {
          text: null,
          error: errorMessage(e, 'Decryption failed.'),
        };
      }
    }

    return results;
  });
}

export { isPrivateKeyFileSelectionCancelled };

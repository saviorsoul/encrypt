import { importPublicKeyExtractable } from '@/crypto/ecdhKeys.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import { parseManifestPayload } from '@/crypto/manifestDecrypt.ts';
import {
  getMessageKeyManifestEntry,
  listKeyIdsForMessage,
} from '@/crypto/storedMessageKeyManifest.ts';

export async function getRecipientsFromMessagePayload(
  payload: string,
): Promise<ManifestRecipientKeys[]> {
  const parsed = parseManifestPayload(payload);
  const entries = Object.values(parsed.keyManifest);

  if (entries.length === 0) {
    throw new Error('Message has no recipients in key manifest.');
  }

  return Promise.all(
    entries.map(async (entry) => {
      const publicJwk = entry.publicKey;
      if (!publicJwk) {
        throw new Error(`Missing public key for recipient ${entry.keyId}.`);
      }

      const publicKey = await importPublicKeyExtractable(publicJwk);
      return { keyId: entry.keyId, publicKey };
    }),
  );
}

export async function getRecipientsFromStoredMessage(
  messageId: string,
): Promise<ManifestRecipientKeys[]> {
  const keyIds = await listKeyIdsForMessage(messageId);

  if (keyIds.length === 0) {
    throw new Error('Message has no recipients in key manifest.');
  }

  return Promise.all(
    keyIds.map(async (keyId) => {
      const entry = await getMessageKeyManifestEntry(messageId, keyId);
      if (!entry) {
        throw new Error(`Missing key manifest entry for recipient ${keyId}.`);
      }
      const publicJwk = entry.publicKey;
      if (!publicJwk) {
        throw new Error(`Missing public key for recipient ${keyId}.`);
      }

      const publicKey = await importPublicKeyExtractable(publicJwk);
      return { keyId: entry.keyId, publicKey };
    }),
  );
}

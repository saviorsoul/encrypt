import { useCallback, useState } from 'react';
import {
  decryptSharedStoredMessage,
  isShareDelivery,
} from '@encrypt/core/crypto/manifestShare';
import { resolveParentMessageAccessFromFeed } from '@encrypt/core/feed/access';
import {
  assembleStoredMessagePayloadFromEntry,
  decryptWithManifest,
} from '@encrypt/core/crypto/manifestDecrypt';
import type { KeyManifestRecipientPayload } from '@encrypt/core/types/manifest';
import type { StoredFeedDelivery } from '@encrypt/core/feed/types';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type WithPrivateKey = ReturnType<
  typeof usePrivateKeySession
>['withPrivateKey'];

type DecryptContext = {
  delivery: StoredFeedDelivery;
  allDeliveries: StoredFeedDelivery[];
  manifestLookup: (
    messageId: string,
    recipientKeyId: string,
  ) => KeyManifestRecipientPayload | null;
};

async function decryptWithMaterial(
  material: UploadedPrivateKeyMaterial,
  { delivery, allDeliveries, manifestLookup }: DecryptContext,
): Promise<string> {
  const recipientKeyId = material.keyId;

  if (!isShareDelivery(delivery)) {
    const access = await resolveParentMessageAccessFromFeed(
      delivery.id,
      recipientKeyId,
      allDeliveries,
      manifestLookup,
    );
    if (!access) {
      throw new Error('No key manifest entry for your key.');
    }

    if (access.deliveryMessageId === delivery.id) {
      const entry = manifestLookup(delivery.id, recipientKeyId);
      if (!entry) {
        throw new Error('Missing key manifest shard.');
      }
      const assembled = assembleStoredMessagePayloadFromEntry(
        delivery.payload,
        recipientKeyId,
        entry,
      );
      return decryptWithManifest(
        assembled,
        material.ecdhPrivateKey,
        recipientKeyId,
      );
    }

    return decryptSharedStoredMessage(
      access.deliveryMessageId,
      access.parentMessageId,
      access.deliveryCorePayloadJson,
      access.parentCorePayloadJson,
      recipientKeyId,
      material.ecdhPrivateKey,
      manifestLookup,
    );
  }

  const parent = allDeliveries.find(
    (row) => row.id === delivery.messageId && !isShareDelivery(row),
  );
  if (!parent || isShareDelivery(parent)) {
    throw new Error('Parent message not found in inbox cache.');
  }

  return decryptSharedStoredMessage(
    delivery.id,
    delivery.messageId,
    delivery.payload,
    parent.payload,
    recipientKeyId,
    material.ecdhPrivateKey,
    manifestLookup,
  );
}

export function useBackendDecrypt(withPrivateKey: WithPrivateKey) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  const decryptDelivery = useCallback(
    async (context: DecryptContext) => {
      setBusy(true);
      setError(null);
      setPlaintext(null);
      try {
        const text = await withPrivateKey((material) =>
          decryptWithMaterial(material, context),
        );
        if (text === null) {
          return null;
        }
        setPlaintext(text);
        return text;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Decrypt failed.';
        setError(message);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [withPrivateKey],
  );

  return { decryptDelivery, busy, error, plaintext };
}

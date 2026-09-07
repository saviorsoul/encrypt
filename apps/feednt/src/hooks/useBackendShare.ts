import { useCallback, useState } from 'react';
import { buildManifestShareWithAccess } from '@encrypt/core/crypto/manifestShare';
import {
  assertUploadedPrivateKeyMatchesKeyId,
  type UploadedPrivateKeyMaterial,
} from '@encrypt/core/crypto/privateKeyMaterial';
import {
  filterRecipientsNeedingShareAccess,
  resolveParentMessageAccessFromFeed,
  resolveShareableMessage,
  type ShareableMessage,
} from '@encrypt/core/feed/access';
import type { CreateShareRequest } from '@encrypt/core/api/feedApi';
import {
  isCreateShareAlreadyComplete,
  isShareRecipientsAlreadyHaveAccessMessage,
} from '@encrypt/core/feed/shareAccess';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { MAX_SHARE_BATCH_SIZE } from '@encrypt/core/constants/shareLimits';
import { useFeedApi } from '@feednt/providers/FeedApiProvider.tsx';
import type { useFeedntPrivateKey } from '@feednt/hooks/useFeedntPrivateKey.ts';

type KeysSession = ReturnType<typeof useFeedntPrivateKey>;

type ShareContext = {
  allDeliveries: Parameters<typeof resolveParentMessageAccessFromFeed>[2];
  manifestLookup: Parameters<typeof resolveParentMessageAccessFromFeed>[3];
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function buildShareRequestsForOwner(
  messageIds: string[],
  ownerKeyId: string,
  recipients: ManifestRecipientKeys[],
  { allDeliveries, manifestLookup }: ShareContext,
  encryptShareable: (
    messageId: string,
    shareable: ShareableMessage,
  ) => Promise<CreateShareRequest>,
): Promise<CreateShareRequest[]> {
  const shares: CreateShareRequest[] = [];

  for (const messageId of messageIds) {
    const shareable = await resolveShareableMessage(
      messageId,
      ownerKeyId,
      recipients,
      allDeliveries,
      manifestLookup,
    );
    if (!shareable) {
      continue;
    }

    shares.push(await encryptShareable(messageId, shareable));
  }

  return shares;
}

async function encryptUploadedKeyShareable(
  material: UploadedPrivateKeyMaterial,
  shareable: ShareableMessage,
  manifestLookup: ShareContext['manifestLookup'],
): Promise<CreateShareRequest> {
  const { shareCoreJson, keyManifest } = await buildManifestShareWithAccess(
    shareable.access,
    material.keyId,
    material.ecdhPrivateKey,
    material.senderPublicKey,
    material.ecdsaSignPrivateKey,
    shareable.recipients,
    manifestLookup,
  );

  return {
    share: JSON.parse(shareCoreJson) as Record<string, unknown>,
    keyManifest,
  };
}

async function withShareMaterial<T>(
  keys: KeysSession,
  expectedKeyId: string | null,
  run: (material: UploadedPrivateKeyMaterial) => Promise<T>,
): Promise<T | null> {
  return keys.withPrivateKey(async (material) => {
    if (expectedKeyId) {
      assertUploadedPrivateKeyMatchesKeyId(
        material,
        expectedKeyId,
        'Uploaded private key does not match your keyId.',
      );
    }

    return run(material);
  });
}

async function buildBatchShareRequests(
  keys: KeysSession,
  expectedKeyId: string | null,
  messageIds: string[],
  recipients: ManifestRecipientKeys[],
  context: ShareContext,
): Promise<CreateShareRequest[]> {
  const shares = await withShareMaterial(keys, expectedKeyId, (material) =>
    buildShareRequestsForOwner(
      messageIds,
      material.keyId,
      recipients,
      context,
      (_messageId, shareable) =>
        encryptUploadedKeyShareable(
          material,
          shareable,
          context.manifestLookup,
        ),
    ),
  );

  return shares ?? [];
}

export function useBackendShare(
  keys: KeysSession,
  expectedKeyId: string | null,
) {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShare, setLastShare] = useState<{
    messageId: string;
    shareId: string;
  } | null>(null);

  const shareMessage = useCallback(
    async ({
      messageId,
      recipients,
      allDeliveries,
      manifestLookup,
    }: ShareContext & {
      messageId: string;
      recipients: ManifestRecipientKeys[];
    }) => {
      setError(null);
      setLastShare(null);

      if (!messageId) {
        setError('No message selected.');
        return null;
      }

      if (recipients.length === 0) {
        setError('Select at least one recipient.');
        return null;
      }

      setBusy(true);
      try {
        const shareId = await keys.withPrivateKey(async (material) => {
          if (expectedKeyId) {
            assertUploadedPrivateKeyMatchesKeyId(
              material,
              expectedKeyId,
              'Uploaded private key does not match your keyId.',
            );
          }

          const access = await resolveParentMessageAccessFromFeed(
            messageId,
            material.keyId,
            allDeliveries,
            manifestLookup,
          );
          if (!access) {
            throw new Error('You cannot share this message.');
          }

          const filteredRecipients = await filterRecipientsNeedingShareAccess(
            messageId,
            recipients,
            allDeliveries,
            manifestLookup,
          );

          if (filteredRecipients.length === 0) {
            return messageId;
          }

          const shareRequest = await encryptUploadedKeyShareable(
            material,
            { access, recipients: filteredRecipients },
            manifestLookup,
          );

          const result = await api.postShare(shareRequest);
          if (isCreateShareAlreadyComplete(result)) {
            return messageId;
          }
          return result.id;
        });
        if (!shareId) {
          setError('Sharing cancelled or private key was not provided.');
          return null;
        }
        if (shareId !== messageId) {
          setLastShare({ messageId, shareId });
        }
        return shareId;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to share message.';
        if (isShareRecipientsAlreadyHaveAccessMessage(message)) {
          return messageId;
        }
        setError(message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, expectedKeyId, keys],
  );

  const shareMessagesBatch = useCallback(
    async ({
      messageIds,
      recipients,
      allDeliveries,
      manifestLookup,
      onProgress,
    }: ShareContext & {
      messageIds: string[];
      recipients: ManifestRecipientKeys[];
      onProgress?: (done: number, total: number) => void;
    }) => {
      setError(null);
      setLastShare(null);

      if (messageIds.length === 0) {
        return;
      }

      if (recipients.length === 0) {
        setError('Select at least one recipient.');
        return;
      }

      setBusy(true);
      try {
        const shares = await buildBatchShareRequests(
          keys,
          expectedKeyId,
          messageIds,
          recipients,
          { allDeliveries, manifestLookup },
        );

        if (shares.length === 0) {
          onProgress?.(messageIds.length, messageIds.length);
          return;
        }

        const batches = chunkArray(shares, MAX_SHARE_BATCH_SIZE);
        let uploaded = 0;
        for (const batch of batches) {
          await api.postShareBatch({ shares: batch });
          uploaded += batch.length;
          onProgress?.(uploaded, messageIds.length);
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to share messages.';
        if (!isShareRecipientsAlreadyHaveAccessMessage(message)) {
          setError(message);
          throw e;
        }
      } finally {
        setBusy(false);
      }
    },
    [api, expectedKeyId, keys],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearLastShare = useCallback(() => {
    setLastShare(null);
  }, []);

  return {
    busy,
    error,
    lastShare,
    shareMessage,
    shareMessagesBatch,
    clearError,
    clearLastShare,
  };
}

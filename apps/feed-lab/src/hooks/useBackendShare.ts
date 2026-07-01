import { useCallback, useState } from 'react';
import { buildManifestShareWithAccess } from '@encrypt/core/crypto/manifestShare';
import {
  recipientHasAccessToParentFromFeed,
  resolveParentMessageAccessFromFeed,
} from '@encrypt/core/feed/access';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type WithPrivateKey = ReturnType<typeof usePrivateKeySession>['withPrivateKey'];

type ShareContext = {
  allDeliveries: Parameters<typeof resolveParentMessageAccessFromFeed>[2];
  manifestLookup: Parameters<typeof resolveParentMessageAccessFromFeed>[3];
};

export function useBackendShare(withPrivateKey: WithPrivateKey) {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastShareId, setLastShareId] = useState<string | null>(null);

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
      setBusy(true);
      setError(null);
      setLastShareId(null);
      try {
        const shareId = await withPrivateKey(async (material) => {
          const access = await resolveParentMessageAccessFromFeed(
            messageId,
            material.keyId,
            allDeliveries,
            manifestLookup,
          );
          if (!access) {
            throw new Error('You cannot share this message.');
          }

          const filteredRecipients: ManifestRecipientKeys[] = [];
          for (const recipient of recipients) {
            if (
              await recipientHasAccessToParentFromFeed(
                messageId,
                recipient.keyId,
                allDeliveries,
                manifestLookup,
              )
            ) {
              continue;
            }
            filteredRecipients.push(recipient);
          }

          if (filteredRecipients.length === 0) {
            throw new Error(
              'Selected recipients already have access to this message.',
            );
          }

          const { shareCoreJson, keyManifest } =
            await buildManifestShareWithAccess(
              access,
              material.keyId,
              material.ecdhPrivateKey,
              material.senderPublicKey,
              material.ecdsaSignPrivateKey,
              filteredRecipients,
              manifestLookup,
            );

          const result = await api.postShare({
            share: JSON.parse(shareCoreJson) as Record<string, unknown>,
            keyManifest,
          });
          return result.id;
        });
        if (!shareId) {
          return null;
        }
        setLastShareId(shareId);
        return shareId;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to share message.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, withPrivateKey],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    lastShareId,
    shareMessage,
    clearError,
  };
}

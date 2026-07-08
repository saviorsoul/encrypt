import { useCallback, useState } from 'react';
import { buildManifestShareWithAccess } from '@encrypt/core/crypto/manifestShare';
import { assertUploadedPrivateKeyMatchesKeyId } from '@encrypt/core/crypto/privateKeyMaterial';
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

export function useBackendShare(
  withPrivateKey: WithPrivateKey,
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
        const shareId = await withPrivateKey(async (material) => {
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
          setError('Sharing cancelled or private key was not provided.');
          return null;
        }
        setLastShare({ messageId, shareId });
        return shareId;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to share message.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, expectedKeyId, withPrivateKey],
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
    clearError,
    clearLastShare,
  };
}

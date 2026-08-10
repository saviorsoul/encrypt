import { useCallback, useState } from 'react';
import { buildManifestShareWithAccess } from '@encrypt/core/crypto/manifestShare';
import { assertUploadedPrivateKeyMatchesKeyId } from '@encrypt/core/crypto/privateKeyMaterial';
import {
  recipientHasAccessToParentFromFeed,
  resolveParentMessageAccessFromFeed,
} from '@encrypt/core/feed/access';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { jwkWithoutKeyOps } from '@encrypt/core/crypto/ecdhKeys';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';
import {
  collectManifestMessageIds,
  serializeManifestLookup,
} from '@lab/lib/manifestLookupWire.ts';

type KeysSession = ReturnType<typeof usePrivateKeySession>;

type ShareContext = {
  allDeliveries: Parameters<typeof resolveParentMessageAccessFromFeed>[2];
  manifestLookup: Parameters<typeof resolveParentMessageAccessFromFeed>[3];
};

export function useBackendShare(keys: KeysSession, expectedKeyId: string | null) {
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
        if (keys.isSystemAppSession) {
          const access = await resolveParentMessageAccessFromFeed(
            messageId,
            keys.keyId!,
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

          const recipientKeyIds = [
            keys.keyId!,
            ...filteredRecipients.map((recipient) => recipient.keyId),
          ];
          const manifestEntries = await serializeManifestLookup(
            manifestLookup,
            collectManifestMessageIds(messageId, access.parentMessageId),
            recipientKeyIds,
          );

          const encrypted = await keys.systemEncryptShare({
            access,
            recipients: await Promise.all(
              filteredRecipients.map(async (recipient) => ({
                keyId: recipient.keyId,
                publicJwk: jwkWithoutKeyOps(
                  await crypto.subtle.exportKey('jwk', recipient.publicKey),
                ),
              })),
            ),
            manifestEntries,
          });

          const result = await api.postShare({
            share: JSON.parse(encrypted.shareCoreJson) as Record<string, unknown>,
            keyManifest: encrypted.keyManifest as Parameters<
              typeof api.postShare
            >[0]['keyManifest'],
          });
          setLastShare({ messageId, shareId: result.id });
          return result.id;
        }

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
    clearError,
    clearLastShare,
  };
}

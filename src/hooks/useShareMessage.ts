import { useCallback, useMemo, useState } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { importPrivateKeyForEcdsaSign } from '@/crypto/ecdsaKeys.ts';
import {
  ecPublicJwkThumbprintSha256,
  slimEcPublicJwk,
} from '@/crypto/jwkThumbprint.ts';
import {
  isPrivateKeyFileSelectionCancelled,
  withUploadedPrivateKey,
} from '@/crypto/privateKeyFile.ts';
import {
  buildManifestShare,
  getCommentThreadMessageId,
  recipientHasAccessToParentMessage,
} from '@/crypto/manifestShare.ts';
import type { ManifestRecipientKeys } from '@/crypto/manifestEncrypt.ts';
import {
  getStoredMessageById,
  saveStoredShare,
  type StoredMessage,
} from '@/crypto/storedMessages.ts';

type UseShareMessageOptions = {
  sourceMessage: StoredMessage | null;
  recipients: ManifestRecipientKeys[];
  recipientsLoading?: boolean;
  onShareCreated?: (shareDelivery: StoredMessage) => void;
};

export function useShareMessage({
  sourceMessage,
  recipients,
  recipientsLoading = false,
  onShareCreated,
}: UseShareMessageOptions) {
  const keys = useKeysContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parentMessageId = sourceMessage
    ? getCommentThreadMessageId(sourceMessage)
    : null;

  const keysReady = useMemo(
    () =>
      Boolean(
        keys?.publicKey &&
        keys?.publicKeyJwk &&
        !recipientsLoading &&
        recipients.length > 0 &&
        recipients.every((recipient) => recipient.publicKey && recipient.keyId),
      ),
    [keys?.publicKey, keys?.publicKeyJwk, recipients, recipientsLoading],
  );

  const handleShare = useCallback(
    async (selectedRecipients: ManifestRecipientKeys[]) => {
      setError(null);

      if (!sourceMessage || !parentMessageId) {
        setError('Message is not ready to share.');
        return;
      }

      if (!keys?.publicKey || !keys?.publicKeyJwk) {
        setError('Keys are not ready yet.');
        return;
      }

      if (selectedRecipients.length === 0) {
        setError('Select at least one recipient.');
        return;
      }

      setBusy(true);
      try {
        await withUploadedPrivateKey(async (ecdhPrivateKey, privateJwk) => {
          const sharerKeyId = await ecPublicJwkThumbprintSha256(
            slimEcPublicJwk(privateJwk),
          );
          if (
            sharerKeyId !==
            (await ecPublicJwkThumbprintSha256(keys.publicKeyJwk!))
          ) {
            throw new Error(
              'Uploaded private key does not match your stored public key.',
            );
          }

          const parentMessage = await getStoredMessageById(parentMessageId);
          if (!parentMessage) {
            throw new Error('Parent message not found.');
          }

          const filteredRecipients: ManifestRecipientKeys[] = [];
          for (const recipient of selectedRecipients) {
            if (recipient.keyId === sharerKeyId) {
              continue;
            }
            if (
              await recipientHasAccessToParentMessage(
                parentMessageId,
                recipient.keyId,
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

          const sharerSigningPrivateKey =
            await importPrivateKeyForEcdsaSign(privateJwk);
          const { shareCoreJson, keyManifest } = await buildManifestShare(
            parentMessageId,
            parentMessage.payload,
            sourceMessage.id,
            sourceMessage.payload,
            sharerKeyId,
            ecdhPrivateKey,
            keys.publicKey!,
            sharerSigningPrivateKey,
            filteredRecipients,
          );

          const savedShare = await saveStoredShare(
            shareCoreJson,
            keyManifest,
            parentMessageId,
          );
          onShareCreated?.(savedShare);
        });
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to share message.');
      } finally {
        setBusy(false);
      }
    },
    [sourceMessage, parentMessageId, keys, onShareCreated],
  );

  return {
    keysReady,
    keysLoading: Boolean(keys?.loading ?? true),
    parentMessageId,
    error,
    busy,
    handleShare,
  };
}

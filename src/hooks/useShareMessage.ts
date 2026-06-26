import { useCallback, useMemo, useState } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { assertUploadedPrivateKeyMatchesKeyId } from '@/crypto/privateKeyMaterial.ts';
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
  assembleShareExportPayloadJson,
  shareExportFilename,
} from '@/crypto/exportFeedMessage.ts';
import {
  getStoredMessageById,
  saveStoredShare,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import { downloadTextFile } from '@/utils/downloadJson.ts';

type UseShareMessageOptions = {
  sourceMessage: StoredMessage | null;
  recipients: ManifestRecipientKeys[];
  recipientsLoading?: boolean;
  onShareCreated?: (shareDelivery: StoredMessage) => void;
  onExported?: () => void;
};

type ShareDeliveryPayload = {
  shareCoreJson: string;
  keyManifest: Awaited<ReturnType<typeof buildManifestShare>>['keyManifest'];
  parentMessageId: string;
};

export function useShareMessage({
  sourceMessage,
  recipients,
  recipientsLoading = false,
  onShareCreated,
  onExported,
}: UseShareMessageOptions) {
  const keys = useKeysContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'share' | 'export' | null>(null);

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

  const buildShareDelivery = useCallback(
    async (
      selectedRecipients: ManifestRecipientKeys[],
      { forExport }: { forExport: boolean },
    ): Promise<ShareDeliveryPayload | null> => {
      setError(null);

      if (!sourceMessage || !parentMessageId) {
        setError('Message is not ready to share.');
        return null;
      }

      if (!keys?.publicKey || !keys?.publicKeyJwk) {
        setError('Keys are not ready yet.');
        return null;
      }

      if (selectedRecipients.length === 0) {
        setError('Select at least one recipient.');
        return null;
      }

      return withUploadedPrivateKey(async (material) => {
        assertUploadedPrivateKeyMatchesKeyId(
          material,
          await ecPublicJwkThumbprintSha256(keys.publicKeyJwk!),
          'Uploaded private key does not match your stored public key.',
        );
        const sharerKeyId = material.keyId;

        const parentMessage = await getStoredMessageById(parentMessageId);
        if (!parentMessage) {
          throw new Error('Parent message not found.');
        }

        const filteredRecipients: ManifestRecipientKeys[] = [];
        for (const recipient of selectedRecipients) {
          if (
            !forExport &&
            (await recipientHasAccessToParentMessage(
              parentMessageId,
              recipient.keyId,
            ))
          ) {
            continue;
          }
          filteredRecipients.push(recipient);
        }

        if (filteredRecipients.length === 0) {
          throw new Error(
            forExport
              ? 'Select at least one recipient.'
              : 'Selected recipients already have access to this message.',
          );
        }

        const { shareCoreJson, keyManifest } = await buildManifestShare(
          parentMessageId,
          sharerKeyId,
          material.ecdhPrivateKey,
          keys.publicKey!,
          material.ecdsaSignPrivateKey,
          filteredRecipients,
        );

        return {
          shareCoreJson,
          keyManifest,
          parentMessageId,
        };
      });
    },
    [sourceMessage, parentMessageId, keys],
  );

  const handleShare = useCallback(
    async (selectedRecipients: ManifestRecipientKeys[]) => {
      setBusy(true);
      setBusyAction('share');
      try {
        const delivery = await buildShareDelivery(selectedRecipients, {
          forExport: false,
        });
        if (!delivery) {
          return;
        }

        const savedShare = await saveStoredShare(
          delivery.shareCoreJson,
          delivery.keyManifest,
          delivery.parentMessageId,
        );
        onShareCreated?.(savedShare);
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to share message.');
      } finally {
        setBusy(false);
        setBusyAction(null);
      }
    },
    [buildShareDelivery, onShareCreated],
  );

  const handleExportFile = useCallback(
    async (selectedRecipients: ManifestRecipientKeys[]) => {
      setBusy(true);
      setBusyAction('export');
      try {
        const delivery = await buildShareDelivery(selectedRecipients, {
          forExport: true,
        });
        if (!delivery) {
          return;
        }

        const payloadJson = assembleShareExportPayloadJson(
          delivery.shareCoreJson,
          delivery.keyManifest,
        );
        const filename = shareExportFilename();

        downloadTextFile(payloadJson, filename);
        window.setTimeout(() => onExported?.(), 0);
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to export message.');
      } finally {
        setBusy(false);
        setBusyAction(null);
      }
    },
    [buildShareDelivery, onExported],
  );

  return {
    keysReady,
    keysLoading: Boolean(keys?.loading ?? true),
    parentMessageId,
    error,
    busy,
    busyAction,
    handleShare,
    handleExportFile,
  };
}

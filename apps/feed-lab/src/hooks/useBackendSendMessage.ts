import { useCallback, useState } from 'react';
import { encryptWithManifest } from '@encrypt/core/crypto/manifestEncrypt';
import { assertUploadedPrivateKeyMatchesKeyId } from '@encrypt/core/crypto/privateKeyMaterial';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { isPrivateKeyFileSelectionCancelled } from '@/crypto/privateKeyFile.ts';
import { assembleMessageCopyPayloadFromWire } from '@lab/lib/assembleMessageCopyPayload.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';
import type { usePrivateKeySession } from '@lab/hooks/usePrivateKeySession.ts';

type WithPrivateKey = ReturnType<typeof usePrivateKeySession>['withPrivateKey'];

export function useBackendSendMessage(
  withPrivateKey: WithPrivateKey,
  expectedKeyId: string | null,
) {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [lastMessageCopyPayload, setLastMessageCopyPayload] = useState<
    string | null
  >(null);

  const sendMessage = useCallback(
    async (
      plaintext: string,
      recipients: ManifestRecipientKeys[],
    ): Promise<string | null> => {
      setError(null);
      setLastMessageId(null);
      setLastMessageCopyPayload(null);

      if (!plaintext.trim()) {
        setError('Enter a message.');
        return null;
      }

      if (recipients.length === 0) {
        setError('Select at least one recipient.');
        return null;
      }

      setBusy(true);
      try {
        const sent = await withPrivateKey(async (material) => {
          if (expectedKeyId) {
            assertUploadedPrivateKeyMatchesKeyId(
              material,
              expectedKeyId,
              'Uploaded private key does not match your keyId.',
            );
          }

          const payload = await encryptWithManifest(
            plaintext,
            recipients,
            material.senderPublicKey,
            material.ecdsaSignPrivateKey,
          );
          const body = JSON.parse(payload) as Record<string, unknown>;
          const result = await api.postMessage(
            body as Parameters<typeof api.postMessage>[0],
          );
          return {
            id: result.id,
            copyPayload: assembleMessageCopyPayloadFromWire(result.id, body),
          };
        });

        if (!sent) {
          return null;
        }

        setLastMessageId(sent.id);
        setLastMessageCopyPayload(sent.copyPayload);
        return sent.id;
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return null;
        }
        setError(e instanceof Error ? e.message : 'Failed to send message.');
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

  const clearLastMessageId = useCallback(() => {
    setLastMessageId(null);
    setLastMessageCopyPayload(null);
  }, []);

  return {
    busy,
    error,
    lastMessageId,
    lastMessageCopyPayload,
    sendMessage,
    clearError,
    clearLastMessageId,
  };
}

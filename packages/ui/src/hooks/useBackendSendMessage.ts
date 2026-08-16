import { useCallback, useState } from 'react';
import type { UploadedPrivateKeyMaterial } from '@encrypt/core/crypto/privateKeyMaterial';
import { encryptWithManifest } from '@encrypt/core/crypto/manifestEncrypt';
import { assertUploadedPrivateKeyMatchesKeyId } from '@encrypt/core/crypto/privateKeyMaterial';
import type { ManifestRecipientKeys } from '@encrypt/core/types/manifest';
import { validateContentPlaintext } from '@encrypt/core/constants/contentLimits';
import { assembleMessageCopyPayloadFromWire } from '@encrypt/core/feed/messageCopyPayload';
import { isPrivateKeyFileSelectionCancelled } from '@encrypt/platform/privateKeyFile';
import { useSendMessageDependencies } from '../components/SendMessageDependenciesContext.tsx';

export type SendMessageKeysSession = {
  keyId: string | null;
  withPrivateKey: <T>(
    fn: (material: UploadedPrivateKeyMaterial) => Promise<T>,
  ) => Promise<T | null>;
} & (
  | {
      isSystemAppSession: true;
      systemEncryptMessage: (
        plaintext: string,
        recipients: ManifestRecipientKeys[],
      ) => Promise<{ body: Record<string, unknown> } | null>;
    }
  | {
      isSystemAppSession?: false;
    }
);

function isSendCancellationError(
  error: unknown,
  isAdditionalCancellationError?: (error: unknown) => boolean,
): boolean {
  return (
    isPrivateKeyFileSelectionCancelled(error) ||
    Boolean(isAdditionalCancellationError?.(error))
  );
}

export function useBackendSendMessage(
  keys: SendMessageKeysSession,
  expectedKeyId: string | null,
) {
  const { useFeedApi, isSendCancellationError: isAdditionalCancellationError } =
    useSendMessageDependencies();
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
    ): Promise<{ id: string; copyPayload: string } | null> => {
      setError(null);
      setLastMessageId(null);
      setLastMessageCopyPayload(null);

      const plaintextError = validateContentPlaintext(plaintext, 'message');
      if (plaintextError) {
        setError(plaintextError);
        return null;
      }

      if (recipients.length === 0) {
        setError('Select at least one recipient.');
        return null;
      }

      setBusy(true);
      try {
        if (keys.isSystemAppSession) {
          const encrypted = await keys.systemEncryptMessage(
            plaintext,
            recipients,
          );
          if (!encrypted) {
            return null;
          }
          const result = await api.postMessage(
            encrypted.body as Parameters<typeof api.postMessage>[0],
          );
          const sent = {
            id: result.id,
            copyPayload: assembleMessageCopyPayloadFromWire(
              result.id,
              encrypted.body,
            ),
          };
          setLastMessageId(sent.id);
          setLastMessageCopyPayload(sent.copyPayload);
          return sent;
        }

        const sent = await keys.withPrivateKey(async (material) => {
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
        return sent;
      } catch (e) {
        if (isSendCancellationError(e, isAdditionalCancellationError)) {
          return null;
        }
        setError(e instanceof Error ? e.message : 'Failed to send message.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [api, expectedKeyId, isAdditionalCancellationError, keys],
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

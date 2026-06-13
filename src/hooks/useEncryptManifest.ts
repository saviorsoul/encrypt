import { useState, useCallback, useMemo } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import {
  encryptWithManifest,
  type ManifestRecipientKeys,
} from '@/crypto/manifestEncrypt.ts';
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
  saveStoredMessage,
  type StoredMessage,
} from '@/crypto/storedMessages.ts';

type UseEncryptManifestOptions = {
  recipients: ManifestRecipientKeys[];
  recipientsLoading?: boolean;
  onMessageSent?: (message: StoredMessage) => void;
  onEncryptSuccess?: (payload: string) => void;
};

export function useEncryptManifest({
  recipients,
  recipientsLoading = false,
  onMessageSent,
  onEncryptSuccess,
}: UseEncryptManifestOptions) {
  const keys = useKeysContext();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const keysReady = useMemo(
    () =>
      Boolean(
        keys?.publicKey &&
        keys?.publicKeyJwk &&
        !recipientsLoading &&
        recipients.length > 0 &&
        recipients.every((r) => r.publicKey && r.keyId),
      ),
    [keys?.publicKey, keys?.publicKeyJwk, recipients, recipientsLoading],
  );

  const handleSend = useCallback(async () => {
    setError(null);

    if (!keys?.publicKey || !keys?.publicKeyJwk) {
      setError('Keys are not ready yet.');
      return;
    }

    const senderPublicKey = keys.publicKey;
    const senderPublicKeyJwk = keys.publicKeyJwk;

    if (recipients.length === 0) {
      setError('Select at least one recipient.');
      return;
    }

    setBusy(true);
    try {
      await withUploadedPrivateKey(async (_ecdhPrivateKey, privateJwk) => {
        const uploadedKeyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(privateJwk),
        );
        if (
          uploadedKeyId !==
          (await ecPublicJwkThumbprintSha256(senderPublicKeyJwk))
        ) {
          throw new Error(
            'Uploaded private key does not match your stored public key.',
          );
        }

        const senderSigningPrivateKey =
          await importPrivateKeyForEcdsaSign(privateJwk);
        const payload = await encryptWithManifest(
          message,
          recipients,
          senderPublicKey,
          senderSigningPrivateKey,
        );
        const savedMessage = await saveStoredMessage(payload);
        setMessage('');
        onMessageSent?.(savedMessage);
        onEncryptSuccess?.(payload);
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to send message.');
    } finally {
      setBusy(false);
    }
  }, [keys, message, recipients, onMessageSent, onEncryptSuccess]);

  const keysLoading = Boolean(keys?.loading ?? true);

  return {
    keysLoading,
    keysReady,
    message,
    setMessage,
    error,
    busy,
    handleSend,
  };
}

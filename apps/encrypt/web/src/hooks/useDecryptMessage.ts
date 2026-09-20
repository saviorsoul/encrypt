import { useState, useCallback, useEffect } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import { decryptMessageWithUploadedPrivateKey } from '@/crypto/messageDecrypt.ts';
import { isPrivateKeyFileSelectionCancelled } from '@/crypto/privateKeyFile.ts';
import { errorMessage } from '@/utils/errorMessage.ts';

export function useDecryptMessage(encryptedPayload: string) {
  const keys = useKeysContext();

  const decryptInput = encryptedPayload;
  const [decryptedText, setDecryptedText] = useState('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decryptBusy, setDecryptBusy] = useState(false);

  const [userRecipientKeyId, setUserRecipientKeyId] = useState<string | null>(
    null,
  );
  const [prevPublicKeyJwk, setPrevPublicKeyJwk] = useState<
    JsonWebKey | null | undefined
  >(undefined);

  const publicKeyJwk = keys?.publicKeyJwk;

  if (publicKeyJwk !== prevPublicKeyJwk) {
    setPrevPublicKeyJwk(publicKeyJwk);
    if (!publicKeyJwk) {
      setUserRecipientKeyId(null);
    }
  }

  useEffect(() => {
    if (!publicKeyJwk) {
      return;
    }
    let cancelled = false;
    void ecPublicJwkThumbprintSha256(publicKeyJwk).then((id) => {
      if (!cancelled) setUserRecipientKeyId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKeyJwk]);

  const decryptUserKeysReady = Boolean(
    keys?.publicKeyJwk && userRecipientKeyId,
  );

  const handleDecrypt = useCallback(() => {
    if (!userRecipientKeyId) {
      setDecryptError('Your public key is not ready yet.');
      return;
    }

    setDecryptError(null);
    setDecryptedText('');

    const trimmed = decryptInput.trim();
    if (!trimmed) {
      setDecryptError(
        'No payload: generate encrypted text in the section above.',
      );
      return;
    }

    void (async () => {
      setDecryptBusy(true);
      try {
        const text = await decryptMessageWithUploadedPrivateKey(
          trimmed,
          userRecipientKeyId,
        );
        setDecryptedText(text);
      } catch (e) {
        if (isPrivateKeyFileSelectionCancelled(e)) {
          return;
        }
        setDecryptError(errorMessage(e, 'Decryption failed.'));
      } finally {
        setDecryptBusy(false);
      }
    })();
  }, [decryptInput, userRecipientKeyId]);

  const keysLoading = Boolean(keys?.loading ?? true);
  const decryptPayloadReady = Boolean(decryptInput.trim());

  return {
    keysLoading,
    decryptPayloadReady,
    decryptedText,
    decryptError,
    decryptBusy,
    decryptUserKeysReady,
    handleDecrypt,
  };
}

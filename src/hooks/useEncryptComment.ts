import { useState, useCallback } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { encryptCommentWithMessageKey } from '@/crypto/commentCrypto.ts';
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
  saveStoredComment,
  type StoredComment,
} from '@/crypto/storedComments.ts';
import { getStoredMessageById } from '@/crypto/storedMessages.ts';
import { hasMessageKeyManifestShard } from '@/crypto/storedMessageKeyManifest.ts';

type UseEncryptCommentOptions = {
  messageId: string;
  onCommentPosted?: (comment: StoredComment) => void;
};

export function useEncryptComment({
  messageId,
  onCommentPosted,
}: UseEncryptCommentOptions) {
  const keys = useKeysContext();
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const keysReady = Boolean(keys?.publicKey && keys?.publicKeyJwk);

  const handlePost = useCallback(async () => {
    setError(null);

    if (!keys?.publicKey || !keys?.publicKeyJwk) {
      setError('Keys are not ready yet.');
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setError('Enter a comment.');
      return;
    }

    setBusy(true);
    try {
      await withUploadedPrivateKey(async (ecdhPrivateKey, privateJwk) => {
        const recipientKeyId = await ecPublicJwkThumbprintSha256(
          slimEcPublicJwk(privateJwk),
        );
        if (
          recipientKeyId !==
          (await ecPublicJwkThumbprintSha256(keys.publicKeyJwk!))
        ) {
          throw new Error(
            'Uploaded private key does not match your stored public key.',
          );
        }

        const parentMessage = await getStoredMessageById(messageId);
        if (!parentMessage) {
          throw new Error(`Message not found: ${messageId}`);
        }

        const canReadMessage = await hasMessageKeyManifestShard(
          messageId,
          recipientKeyId,
        );
        if (!canReadMessage) {
          throw new Error(
            'You cannot comment on this message — no key manifest entry for your key.',
          );
        }

        const senderSigningPrivateKey =
          await importPrivateKeyForEcdsaSign(privateJwk);
        const payload = await encryptCommentWithMessageKey(
          trimmed,
          messageId,
          parentMessage.payload,
          recipientKeyId,
          ecdhPrivateKey,
          keys.publicKey!,
          senderSigningPrivateKey,
        );
        const savedComment = await saveStoredComment(messageId, payload);
        setCommentText('');
        onCommentPosted?.(savedComment);
      });
    } catch (e) {
      if (isPrivateKeyFileSelectionCancelled(e)) {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to post comment.');
    } finally {
      setBusy(false);
    }
  }, [commentText, keys, messageId, onCommentPosted]);

  const keysLoading = Boolean(keys?.loading ?? true);

  return {
    keysLoading,
    keysReady,
    commentText,
    setCommentText,
    error,
    busy,
    handlePost,
  };
}

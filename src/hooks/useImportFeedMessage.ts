import { useCallback, useState } from 'react';
import { getCommentThreadMessageId } from '@/crypto/manifestShare.ts';
import { importParsedFeedMessage } from '@/crypto/importFeedMessage.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  encryptedMessageFingerprintsMatch,
  type EncryptedMessageFingerprint,
} from '@/types/oneToOne.ts';
import {
  parseImportPayloadText,
  recipientKeyInImportPayload,
  shareImportContentFingerprint,
  type ParsedImportPayload,
} from '@/utils/parseImportPayloadText.ts';
import { validateImportJsonText } from '@/utils/readImportJsonFile.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import type { StoredMessage } from '@/crypto/storedMessages.ts';

function findDuplicateMessageId(
  messages: StoredMessage[],
  fingerprint: EncryptedMessageFingerprint,
): string | null {
  for (const message of messages) {
    const existing = encryptedMessageFingerprintFromPayloadJson(
      message.payload,
    );
    if (
      existing !== null &&
      encryptedMessageFingerprintsMatch(existing, fingerprint)
    ) {
      return message.id;
    }
  }
  return null;
}

export function validateImportPayloadText(text: string): string | null {
  const validated = validateImportJsonText(text);
  if (validated.ok === false) {
    return validated.error;
  }
  return null;
}

export function validateImportForRecipient(
  text: string,
  recipientKeyId: string | null,
  existingMessages: StoredMessage[],
): string | null {
  const validated = validateImportJsonText(text);
  if (validated.ok === false) {
    return validated.error;
  }

  const trimmed = validated.text;
  if (!trimmed) {
    return 'Paste or load signed manifest JSON first.';
  }

  const parsed = parseImportPayloadText(trimmed);
  if (parsed.ok === false) {
    return parsed.error;
  }

  if (
    recipientKeyId &&
    !recipientKeyInImportPayload(parsed.payload, recipientKeyId)
  ) {
    return 'Your public key is not listed as a recipient in this message.';
  }

  if (parsed.payload.kind === 'original') {
    const fingerprint = encryptedMessageFingerprintFromPayloadJson(trimmed);
    if (fingerprint !== null) {
      const duplicateId = findDuplicateMessageId(existingMessages, fingerprint);
      if (duplicateId !== null) {
        return 'This message is already in your feed.';
      }
    }
  }

  if (parsed.payload.kind === 'share') {
    const fingerprint = shareImportContentFingerprint(parsed.payload);
    if (fingerprint !== null) {
      for (const message of existingMessages) {
        const threadId = getCommentThreadMessageId(message);
        const parent = existingMessages.find((row) => row.id === threadId);
        if (!parent) {
          continue;
        }
        const existing = encryptedMessageFingerprintFromPayloadJson(
          parent.payload,
        );
        if (
          existing !== null &&
          encryptedMessageFingerprintsMatch(existing, fingerprint)
        ) {
          return 'You already have access to this message in your feed.';
        }
      }
    }
  }

  return null;
}

type UseImportFeedMessageOptions = {
  recipientKeyId: string | null;
  existingMessages: StoredMessage[];
  onImported?: (message: StoredMessage) => void;
};

export function useImportFeedMessage({
  recipientKeyId,
  existingMessages,
  onImported,
}: UseImportFeedMessageOptions) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validateForImport = useCallback(
    (text: string): string | null => {
      return validateImportForRecipient(text, recipientKeyId, existingMessages);
    },
    [recipientKeyId, existingMessages],
  );

  const confirmImport = useCallback(
    async (text: string): Promise<boolean> => {
      setError(null);

      const validated = validateImportJsonText(text);
      if (validated.ok === false) {
        setError(validated.error);
        return false;
      }

      const importError = validateImportForRecipient(
        validated.text,
        recipientKeyId,
        existingMessages,
      );
      if (importError) {
        setError(importError);
        return false;
      }

      const parsed = parseImportPayloadText(validated.text);
      if (parsed.ok === false) {
        setError(parsed.error);
        return false;
      }

      if (!recipientKeyId) {
        setError('Keys are not ready yet.');
        return false;
      }

      setBusy(true);
      try {
        const savedMessage = await importParsedFeedMessage(
          parsed.payload,
          recipientKeyId,
        );
        onImported?.(savedMessage);
        return true;
      } catch (e) {
        setError(errorMessage(e, 'Failed to import message.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [recipientKeyId, existingMessages, onImported],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    busy,
    confirmImport,
    validateForImport,
    clearError,
    validatePayloadText: validateImportPayloadText,
  };
}

export type { ParsedImportPayload };

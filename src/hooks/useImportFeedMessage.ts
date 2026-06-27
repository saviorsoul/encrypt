import { useCallback, useEffect, useState } from 'react';
import { importParsedFeedMessage } from '@/crypto/importFeedMessage.ts';
import {
  encryptedMessageFingerprintFromPayloadJson,
  encryptedMessageFingerprintsMatch,
  type EncryptedMessageFingerprint,
} from '@/types/oneToOne.ts';
import {
  parseImportPayloadText,
  recipientKeyInImportPayload,
  type ParsedImportPayload,
} from '@/utils/parseImportPayloadText.ts';
import { validateImportJsonText } from '@/utils/readImportJsonFile.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import type {
  StoredFeedDelivery,
  StoredMessage,
} from '@/services/db/storedMessages.ts';
import { getStoredMessageById } from '@/services/db/storedMessages.ts';

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

export async function validateImportForRecipient(
  text: string,
  recipientKeyId: string | null,
  existingMessages: StoredMessage[],
): Promise<string | null> {
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
    const originalPayload = parsed.payload;
    if (originalPayload.exportedMessageId) {
      const existing = await getStoredMessageById(
        originalPayload.exportedMessageId,
      );
      if (existing) {
        return 'This message is already in your feed.';
      }
    } else {
      const fingerprint = encryptedMessageFingerprintFromPayloadJson(
        originalPayload.fullPayloadJson,
      );
      if (fingerprint !== null) {
        const duplicateId = findDuplicateMessageId(
          existingMessages,
          fingerprint,
        );
        if (duplicateId !== null) {
          return 'This message is already in your feed.';
        }
      }
    }
  }

  if (parsed.payload.kind === 'share') {
    const sharePayload = parsed.payload;
    const parentMessage = await getStoredMessageById(
      sharePayload.parentMessageId,
    );
    if (!parentMessage) {
      return 'Parent message not found. Import the original message first.';
    }
  }

  return null;
}

/** Async import validation; only updates state when IndexedDB checks complete. */
export function useImportFeedValidation(
  text: string | null,
  enabled: boolean,
  validateForImport: (text: string) => Promise<string | null>,
) {
  const [result, setResult] = useState<{
    text: string;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !text) {
      return;
    }

    let cancelled = false;

    void validateForImport(text).then((error) => {
      if (!cancelled) {
        setResult({ text, error });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, text, validateForImport]);

  const pending = Boolean(enabled && text && result?.text !== text);
  const error = enabled && text && result?.text === text ? result.error : null;

  return { error, pending };
}

type UseImportFeedMessageOptions = {
  recipientKeyId: string | null;
  existingMessages: StoredMessage[];
  onImported?: (message: StoredFeedDelivery) => void;
};

export function useImportFeedMessage({
  recipientKeyId,
  existingMessages,
  onImported,
}: UseImportFeedMessageOptions) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validateForImport = useCallback(
    async (text: string): Promise<string | null> => {
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

      const importError = await validateImportForRecipient(
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

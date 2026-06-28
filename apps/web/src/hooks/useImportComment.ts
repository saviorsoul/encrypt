import { useCallback, useState } from 'react';
import { importParsedComment } from '@/crypto/importComment.ts';
import { parseCommentImportPayloadText } from '@/utils/parseCommentImportPayloadText.ts';
import { validateImportJsonText } from '@/utils/readImportJsonFile.ts';
import { errorMessage } from '@/utils/errorMessage.ts';
import type { StoredComment } from '@/services/db/storedComments.ts';

export function validateCommentImportPayloadText(text: string): string | null {
  const validated = validateImportJsonText(text);
  if (validated.ok === false) {
    return validated.error;
  }
  const parsed = parseCommentImportPayloadText(validated.text);
  if (parsed.ok === false) {
    return parsed.error;
  }
  return null;
}

type UseImportCommentOptions = {
  recipientKeyId: string | null;
  onImported?: (comment: StoredComment) => void;
};

export function useImportComment({
  recipientKeyId,
  onImported,
}: UseImportCommentOptions) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validateForImport = useCallback(
    (text: string): string | null => {
      const parseError = validateCommentImportPayloadText(text);
      if (parseError) {
        return parseError;
      }
      if (!recipientKeyId) {
        return 'Keys are not ready yet.';
      }
      return null;
    },
    [recipientKeyId],
  );

  const confirmImport = useCallback(
    async (text: string): Promise<boolean> => {
      setError(null);

      const validated = validateImportJsonText(text);
      if (validated.ok === false) {
        setError(validated.error);
        return false;
      }

      const parseError = validateCommentImportPayloadText(validated.text);
      if (parseError) {
        setError(parseError);
        return false;
      }

      if (!recipientKeyId) {
        setError('Keys are not ready yet.');
        return false;
      }

      const parsed = parseCommentImportPayloadText(validated.text);
      if (parsed.ok === false) {
        setError(parsed.error);
        return false;
      }

      setBusy(true);
      try {
        const savedComment = await importParsedComment(
          parsed.payload,
          recipientKeyId,
        );
        onImported?.(savedComment);
        return true;
      } catch (e) {
        setError(errorMessage(e, 'Failed to import comment.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [recipientKeyId, onImported],
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
    validatePayloadText: validateCommentImportPayloadText,
  };
}

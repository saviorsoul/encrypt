import { useEffect, useMemo, useState } from 'react';
import {
  planOriginalImport,
  planShareImport,
} from '@/crypto/importFeedMessageAnalysis.ts';
import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';
import type { ParsedImportPayload } from '@/utils/parseImportPayloadText.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';

type CommentsOnlyImportPreviewContext = {
  analysisKey: string;
  payload: ParsedImportPayload;
};

function buildCommentsOnlyImportPreviewContext(
  previewManifest: string,
  existingMessages: StoredMessage[],
): CommentsOnlyImportPreviewContext | null {
  const parsed = parseImportPayloadText(previewManifest);
  if (parsed.ok === false) {
    return null;
  }

  if ((parsed.payload.comments?.length ?? 0) === 0) {
    return null;
  }

  const inboxKey = existingMessages.map((message) => message.id).join('\0');
  return {
    analysisKey: `${previewManifest}\0${inboxKey}`,
    payload: parsed.payload,
  };
}

export function useCommentsOnlyImportPreview(
  previewManifest: string | null,
  existingMessages: StoredMessage[],
  recipientKeyId: string | null,
): { missingCount: number } | null {
  const previewContext = useMemo(() => {
    if (!previewManifest) {
      return null;
    }
    return buildCommentsOnlyImportPreviewContext(
      previewManifest,
      existingMessages,
    );
  }, [previewManifest, existingMessages]);

  const [resolved, setResolved] = useState<{
    key: string;
    value: { missingCount: number } | null;
  } | null>(null);

  useEffect(() => {
    if (!previewContext || !recipientKeyId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const plan =
        previewContext.payload.kind === 'share'
          ? await planShareImport(previewContext.payload, recipientKeyId)
          : await planOriginalImport(previewContext.payload, existingMessages);

      if (cancelled) {
        return;
      }

      setResolved({
        key: previewContext.analysisKey,
        value:
          plan.mode === 'comments-only'
            ? { missingCount: plan.missingComments.length }
            : null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [previewContext, existingMessages, recipientKeyId]);

  if (!previewContext) {
    return null;
  }

  if (resolved?.key !== previewContext.analysisKey) {
    return null;
  }

  return resolved.value;
}

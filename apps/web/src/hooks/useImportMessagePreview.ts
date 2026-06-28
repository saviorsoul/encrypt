import { useEffect, useMemo, useState } from 'react';
import { splitManifestForStorage } from '@/crypto/manifestStorage.ts';
import type { StoredMessage } from '@/services/db/storedMessages.ts';
import { resolveSenderLabelFromImportText } from '@/utils/resolveSenderLabel.ts';
import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';

export const IMPORT_PREVIEW_MESSAGE_ID = 'import-preview';

function buildPreviewMessage(
  parsed: Extract<ReturnType<typeof parseImportPayloadText>, { ok: true }>,
): StoredMessage {
  if (parsed.payload.kind === 'share') {
    return {
      id: IMPORT_PREVIEW_MESSAGE_ID,
      payload: JSON.stringify(parsed.payload.shareWire),
      createdAt: Date.now(),
    };
  }

  const { corePayloadJson } = splitManifestForStorage(
    parsed.payload.fullPayloadJson,
  );
  return {
    id: IMPORT_PREVIEW_MESSAGE_ID,
    payload: corePayloadJson,
    createdAt: Date.now(),
  };
}

export function useImportMessagePreview(
  manifestText: string | null,
  enabled: boolean,
) {
  const activeText = enabled && manifestText ? manifestText : null;

  const parsed = useMemo(() => {
    if (!activeText) {
      return null;
    }
    return parseImportPayloadText(activeText);
  }, [activeText]);

  const previewMessage = useMemo((): StoredMessage | null => {
    if (!parsed || parsed.ok === false) {
      return null;
    }

    try {
      return buildPreviewMessage(parsed);
    } catch {
      return null;
    }
  }, [parsed]);

  const error = useMemo((): string | null => {
    if (!parsed) {
      return null;
    }
    if (parsed.ok === false) {
      return parsed.error;
    }
    if (previewMessage === null) {
      return 'Failed to build preview.';
    }
    return null;
  }, [parsed, previewMessage]);

  const [senderLabelState, setSenderLabelState] = useState<{
    text: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!activeText) {
      return;
    }

    let cancelled = false;

    void resolveSenderLabelFromImportText(activeText)
      .then((label) => {
        if (!cancelled) {
          setSenderLabelState({ text: activeText, label });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSenderLabelState({ text: activeText, label: 'Not known' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeText]);

  const senderLabel =
    activeText && senderLabelState?.text === activeText
      ? senderLabelState.label
      : 'Not known';

  const loading = Boolean(
    activeText && senderLabelState?.text !== activeText && error === null,
  );

  return {
    previewMessage: activeText ? previewMessage : null,
    senderLabel: activeText ? senderLabel : 'Not known',
    error: activeText ? error : null,
    loading: activeText ? loading : false,
  };
}

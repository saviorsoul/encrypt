import { useCallback, useState } from 'react';
import { jsonSyntaxError } from '@lab/lib/validateJsonSyntax.ts';
import {
  postImportJsonToBackend,
  importApiPathForKind,
} from '@lab/lib/postImportJsonToBackend.ts';
import { useFeedApi } from '@lab/providers/FeedApiProvider.tsx';

export function useSendImportToBackend() {
  const api = useFeedApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const validatePayloadText = useCallback(
    (text: string) => jsonSyntaxError(text),
    [],
  );

  const sendImport = useCallback(
    async (text: string): Promise<boolean> => {
      setError(null);
      setLastResult(null);

      setBusy(true);
      try {
        const posted = await postImportJsonToBackend(api, text);
        setLastResult(
          `Posted ${posted.kind} (${posted.id}) via POST /api/${importApiPathForKind(posted.kind)}`,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send to backend.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    busy,
    error,
    lastResult,
    sendImport,
    validatePayloadText,
    clearError,
  };
}

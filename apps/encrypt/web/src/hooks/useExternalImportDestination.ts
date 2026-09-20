import { useEffect, useRef } from 'react';
import {
  useExternalFileContext,
  type PendingExternalImport,
} from '@/components/providers/ExternalFileProvider.tsx';
import type { ImportDestination } from '@/utils/importDestination.ts';

/** Register a live import handler and consume queued cross-route imports. */
export function useExternalImportDestination(
  destination: ImportDestination,
  onImport: (payload: PendingExternalImport) => void,
) {
  const {
    registerImportHandler,
    importRequestId,
    pendingImport,
    consumePendingImport,
  } = useExternalFileContext();
  const lastHandledRequestIdRef = useRef(0);

  useEffect(() => {
    return registerImportHandler(destination, onImport);
  }, [destination, registerImportHandler, onImport]);

  useEffect(() => {
    if (importRequestId === 0) {
      return;
    }
    if (importRequestId === lastHandledRequestIdRef.current) {
      return;
    }
    if (!pendingImport || pendingImport.destination !== destination) {
      return;
    }

    lastHandledRequestIdRef.current = importRequestId;
    const consumed = consumePendingImport();
    if (!consumed) {
      return;
    }

    onImport(consumed);
  }, [
    importRequestId,
    pendingImport,
    destination,
    consumePendingImport,
    onImport,
  ]);
}

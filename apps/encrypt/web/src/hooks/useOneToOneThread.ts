import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadOneToOneThread,
  messagePartyKeyIds,
  saveOneToOneMessage,
  threadItemToStoredMessage,
} from '@/services/db/storedOneToOneMessages.ts';
import type { OneToOneThreadItem, ThreadSide } from '@/types/oneToOne.ts';

function applyPendingDecryptions(
  items: OneToOneThreadItem[],
  pending: Map<string, string>,
): OneToOneThreadItem[] {
  return items.map((item) => {
    const plaintext = pending.get(item.id);
    if (plaintext === undefined) {
      return item;
    }

    pending.delete(item.id);
    return { ...item, text: plaintext, decryptedAt: Date.now() };
  });
}

type UseOneToOneThreadOptions = {
  viewerKeyId: string | null;
  peerKeyId: string | null;
  partySenderKeyId: string | null;
  partyRecipientKeyId: string | null;
};

export function useOneToOneThread({
  viewerKeyId,
  peerKeyId,
  partySenderKeyId,
  partyRecipientKeyId,
}: UseOneToOneThreadOptions) {
  const [thread, setThread] = useState<OneToOneThreadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedPairKey, setLoadedPairKey] = useState<string | null>(null);
  const [prevPairKey, setPrevPairKey] = useState<string | null>(null);
  const pendingDecryptedTextRef = useRef(new Map<string, string>());

  const mergePendingDecryptions = useCallback((items: OneToOneThreadItem[]) => {
    return applyPendingDecryptions(items, pendingDecryptedTextRef.current);
  }, []);

  const queueThreadItemDecryption = useCallback(
    (messageId: string, plaintext: string) => {
      pendingDecryptedTextRef.current.set(messageId, plaintext);
    },
    [],
  );

  const pairKey =
    viewerKeyId && peerKeyId ? `${viewerKeyId}:${peerKeyId}` : null;

  if (pairKey !== prevPairKey) {
    setPrevPairKey(pairKey);
    if (!pairKey) {
      setThread([]);
      setLoadedPairKey(null);
      setLoading(false);
    } else if (loadedPairKey !== pairKey) {
      setThread([]);
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!pairKey || loadedPairKey === pairKey) {
      return;
    }

    let cancelled = false;

    void loadOneToOneThread(viewerKeyId!, peerKeyId!)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setLoadedPairKey(pairKey);
        setThread(mergePendingDecryptions(items));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pairKey, loadedPairKey, viewerKeyId, peerKeyId, mergePendingDecryptions]);

  const persistThreadItem = useCallback(
    async (
      item: OneToOneThreadItem,
      encryptorSide: ThreadSide,
      manifestSenderKeyId?: string,
    ) => {
      if (
        !viewerKeyId ||
        !peerKeyId ||
        !partySenderKeyId ||
        !partyRecipientKeyId
      ) {
        return;
      }

      const partyIds =
        manifestSenderKeyId !== undefined
          ? {
              senderKeyId: manifestSenderKeyId,
              recipientKeyId:
                manifestSenderKeyId === partySenderKeyId
                  ? partyRecipientKeyId
                  : partySenderKeyId,
            }
          : messagePartyKeyIds(
              encryptorSide,
              partySenderKeyId,
              partyRecipientKeyId,
            );

      const stored = threadItemToStoredMessage(
        item,
        viewerKeyId,
        peerKeyId,
        partyIds.senderKeyId,
        partyIds.recipientKeyId,
      );
      await saveOneToOneMessage(stored);
    },
    [viewerKeyId, peerKeyId, partySenderKeyId, partyRecipientKeyId],
  );

  const appendThreadItem = useCallback(
    async (
      item: OneToOneThreadItem,
      encryptorSide: ThreadSide,
      options?: { manifestSenderKeyId?: string; decryptedText?: string },
    ) => {
      const displayItem: OneToOneThreadItem =
        options?.decryptedText !== undefined
          ? {
              ...item,
              text: options.decryptedText,
              decryptedAt: Date.now(),
            }
          : item;

      setThread((prev) => [displayItem, ...prev]);
      await persistThreadItem(
        item,
        encryptorSide,
        options?.manifestSenderKeyId,
      );
    },
    [persistThreadItem],
  );

  const markThreadItemDecrypted = useCallback(
    (messageId: string, text: string) => {
      const decryptedAt = Date.now();
      setThread((prev) =>
        prev.map((item) =>
          item.id === messageId ? { ...item, text, decryptedAt } : item,
        ),
      );
    },
    [],
  );

  const prependPersistedThreadItem = useCallback(
    (item: OneToOneThreadItem) => {
      const [displayItem] = mergePendingDecryptions([item]);
      setThread((prev) => [displayItem, ...prev]);
    },
    [mergePendingDecryptions],
  );

  return {
    thread,
    loading,
    appendThreadItem,
    markThreadItemDecrypted,
    prependPersistedThreadItem,
    queueThreadItemDecryption,
  };
}

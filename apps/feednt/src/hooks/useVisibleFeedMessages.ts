import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoredMessage } from '@encrypt/core/feed/types';
import type { useBackendDecrypt } from '@feednt/hooks/useBackendDecrypt.ts';

type DecryptFeedContext = Parameters<
  ReturnType<typeof useBackendDecrypt>['decryptDeliveries']
>[1];

type UseVisibleFeedMessagesOptions = {
  messages: StoredMessage[];
  feedLoading: boolean;
  automateDecryption: boolean;
  decryptDeliveries: ReturnType<typeof useBackendDecrypt>['decryptDeliveries'];
  feedContext: DecryptFeedContext;
};

export function useVisibleFeedMessages({
  messages,
  feedLoading,
  automateDecryption,
  decryptDeliveries,
  feedContext,
}: UseVisibleFeedMessagesOptions) {
  const [visibleMessages, setVisibleMessages] = useState<StoredMessage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const feedContextRef = useRef(feedContext);
  const lastProcessedMessageIdsKeyRef = useRef<string | null>(null);

  const messageIdsKey = useMemo(
    () => messages.map((message) => message.id).join('\0'),
    [messages],
  );

  const visibleMessageIds = useMemo(
    () => new Set(visibleMessages.map((message) => message.id)),
    [visibleMessages],
  );

  const pendingPreparation = useMemo(() => {
    if (feedLoading || !automateDecryption || messages.length === 0) {
      return false;
    }

    return messages.some((message) => !visibleMessageIds.has(message.id));
  }, [automateDecryption, feedLoading, messages, visibleMessageIds]);

  useEffect(() => {
    feedContextRef.current = feedContext;
  }, [feedContext]);

  useEffect(() => {
    if (feedLoading) {
      lastProcessedMessageIdsKeyRef.current = null;
      return;
    }

    if (!automateDecryption) {
      setVisibleMessages(messages);
      setPreparing(false);
      return;
    }

    if (messages.length === 0) {
      setVisibleMessages([]);
      setPreparing(false);
      lastProcessedMessageIdsKeyRef.current = messageIdsKey;
      return;
    }

    const visibleIds = new Set(visibleMessages.map((message) => message.id));
    const hasNewMessageIds = messages.some(
      (message) => !visibleIds.has(message.id),
    );

    if (!hasNewMessageIds) {
      if (lastProcessedMessageIdsKeyRef.current === messageIdsKey) {
        return;
      }

      lastProcessedMessageIdsKeyRef.current = messageIdsKey;
      setVisibleMessages(messages);
      setPreparing(false);
      void decryptDeliveries(messages, feedContextRef.current);
      return;
    }

    let cancelled = false;
    setPreparing(true);

    void decryptDeliveries(messages, feedContextRef.current)
      .then(() => {
        if (!cancelled) {
          setVisibleMessages(messages);
          lastProcessedMessageIdsKeyRef.current = messageIdsKey;
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreparing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    automateDecryption,
    decryptDeliveries,
    feedLoading,
    messageIdsKey,
    messages,
    visibleMessages,
  ]);

  if (!automateDecryption) {
    return {
      visibleMessages: feedLoading ? visibleMessages : messages,
      preparing: false,
    };
  }

  return {
    visibleMessages,
    preparing: preparing || pendingPreparation,
  };
}

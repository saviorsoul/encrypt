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
  decryptDeliveries: ReturnType<
    typeof useBackendDecrypt
  >['decryptDeliveries'];
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
  const visibleMessageIdsRef = useRef<Set<string>>(new Set());
  const feedContextRef = useRef(feedContext);

  feedContextRef.current = feedContext;

  const messageIdsKey = useMemo(
    () => messages.map((message) => message.id).join('\0'),
    [messages],
  );

  useEffect(() => {
    visibleMessageIdsRef.current = new Set(
      visibleMessages.map((message) => message.id),
    );
  }, [visibleMessages]);

  useEffect(() => {
    if (feedLoading) {
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
      return;
    }

    const currentVisibleIds = visibleMessageIdsRef.current;
    const isInitialLoad = currentVisibleIds.size === 0;
    const hasNewMessageIds = messages.some(
      (message) => !currentVisibleIds.has(message.id),
    );

    if (!isInitialLoad && !hasNewMessageIds) {
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
  }, [automateDecryption, decryptDeliveries, feedLoading, messageIdsKey]);

  return { visibleMessages, preparing };
}

import { useCallback, useState } from 'react';

export function useFeedMessageEnterState() {
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const onAnimationDone = useCallback((messageId: string) => {
    setAnimatedMessageIds((current) => {
      if (current.has(messageId)) {
        return current;
      }
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const shouldAnimateEntry = useCallback(
    (messageId: string) => !animatedMessageIds.has(messageId),
    [animatedMessageIds],
  );

  const getStaggerIndex = useCallback(
    (messageId: string, visibleMessageIds: string[]) => {
      if (animatedMessageIds.has(messageId)) {
        return 0;
      }
      const pendingIds = visibleMessageIds.filter(
        (id) => !animatedMessageIds.has(id),
      );
      const index = pendingIds.indexOf(messageId);
      return index >= 0 ? index : 0;
    },
    [animatedMessageIds],
  );

  return {
    shouldAnimateEntry,
    onAnimationDone,
    getStaggerIndex,
  };
}

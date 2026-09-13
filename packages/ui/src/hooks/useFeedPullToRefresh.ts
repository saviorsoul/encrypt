import { useEffect, useRef } from 'react';

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;
const SCROLL_TOP_EPSILON_PX = 2;

type UseFeedPullToRefreshOptions = {
  enabled: boolean;
  disabled?: boolean;
  onRefresh: () => void | Promise<void>;
};

export function useFeedPullToRefresh({
  enabled,
  disabled = false,
  onRefresh,
}: UseFeedPullToRefreshOptions) {
  const touchStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const onRefreshRef = useRef(onRefresh);

  disabledRef.current = disabled;
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const canStartPull = () =>
      !disabledRef.current &&
      !refreshingRef.current &&
      window.scrollY <= SCROLL_TOP_EPSILON_PX;

    const resetPull = () => {
      touchStartYRef.current = null;
      pullingRef.current = false;
      pullDistanceRef.current = 0;
    };

    const triggerRefresh = async () => {
      if (refreshingRef.current || disabledRef.current) {
        return;
      }

      refreshingRef.current = true;
      try {
        await onRefreshRef.current();
      } finally {
        refreshingRef.current = false;
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!canStartPull()) {
        resetPull();
        return;
      }

      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      pullingRef.current = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      if (startY == null || !canStartPull()) {
        return;
      }

      const currentY = event.touches[0]?.clientY;
      if (currentY == null) {
        return;
      }

      const delta = currentY - startY;
      if (delta <= 0) {
        resetPull();
        return;
      }

      pullingRef.current = true;
      pullDistanceRef.current = Math.min(delta, MAX_PULL_PX);
    };

    const onTouchEnd = () => {
      const distance = pullDistanceRef.current;
      const shouldRefresh =
        pullingRef.current && distance >= PULL_THRESHOLD_PX && canStartPull();
      resetPull();

      if (shouldRefresh) {
        void triggerRefresh();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', resetPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', resetPull);
    };
  }, [enabled]);
}

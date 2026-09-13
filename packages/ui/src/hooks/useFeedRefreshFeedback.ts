import { useCallback, useEffect, useRef, useState } from 'react';

const FEED_REFRESH_PULSE_MS = 480;

type UseFeedRefreshFeedbackOptions = {
  feedBusy: boolean;
  feedError: string | null;
};

export function useFeedRefreshFeedback({
  feedBusy,
  feedError,
}: UseFeedRefreshFeedbackOptions) {
  const refreshPendingRef = useRef(false);
  const wasFeedBusyRef = useRef(feedBusy);
  const [isFeedPulsing, setIsFeedPulsing] = useState(false);

  const markRefreshStarted = useCallback(() => {
    refreshPendingRef.current = true;
    setIsFeedPulsing(false);
  }, []);

  useEffect(() => {
    const wasFeedBusy = wasFeedBusyRef.current;
    wasFeedBusyRef.current = feedBusy;

    if (!refreshPendingRef.current || feedBusy || !wasFeedBusy) {
      return;
    }

    refreshPendingRef.current = false;
    if (feedError) {
      return;
    }

    setIsFeedPulsing(true);

    const pulseTimeout = window.setTimeout(() => {
      setIsFeedPulsing(false);
    }, FEED_REFRESH_PULSE_MS);

    return () => {
      window.clearTimeout(pulseTimeout);
    };
  }, [feedBusy, feedError]);

  return {
    isFeedPulsing,
    markRefreshStarted,
  };
}

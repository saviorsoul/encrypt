import { useCallback, useEffect, useRef, useState } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

const FEED_REFRESH_PULSE = 'feedRefreshPulse';
const FEED_REFRESH_PULSE_MS = 480;
const FEED_REFRESH_SUCCESS_MS = 2000;

type UseFeedRefreshFeedbackOptions = {
  feedBusy: boolean;
  feedError: string | null;
};

export function useFeedRefreshFeedback({
  feedBusy,
  feedError,
}: UseFeedRefreshFeedbackOptions) {
  const refreshPendingRef = useRef(false);
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [isFeedPulsing, setIsFeedPulsing] = useState(false);

  const markRefreshStarted = useCallback(() => {
    refreshPendingRef.current = true;
    setShowRefreshSuccess(false);
  }, []);

  useEffect(() => {
    if (!refreshPendingRef.current || feedBusy) {
      return;
    }

    refreshPendingRef.current = false;
    if (feedError) {
      return;
    }

    setShowRefreshSuccess(true);
    setIsFeedPulsing(true);

    const pulseTimeout = window.setTimeout(() => {
      setIsFeedPulsing(false);
    }, FEED_REFRESH_PULSE_MS);
    const successTimeout = window.setTimeout(() => {
      setShowRefreshSuccess(false);
    }, FEED_REFRESH_SUCCESS_MS);

    return () => {
      window.clearTimeout(pulseTimeout);
      window.clearTimeout(successTimeout);
    };
  }, [feedBusy, feedError]);

  const feedListPulseSx: SxProps<Theme> = {
    [`@keyframes ${FEED_REFRESH_PULSE}`]: {
      '0%': { opacity: 1 },
      '40%': { opacity: 0.5 },
      '100%': { opacity: 1 },
    },
    animation: isFeedPulsing
      ? `${FEED_REFRESH_PULSE} ${FEED_REFRESH_PULSE_MS}ms ease-out both`
      : undefined,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  };

  return {
    showRefreshSuccess,
    markRefreshStarted,
    feedListPulseSx,
  };
}

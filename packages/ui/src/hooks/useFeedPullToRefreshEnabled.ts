import { useEffect, useState } from 'react';

const COARSE_POINTER_MEDIA_QUERY = '(hover: none) and (pointer: coarse)';

export function matchesFeedPullToRefreshTarget(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }

  return window.matchMedia(COARSE_POINTER_MEDIA_QUERY).matches;
}

export function useFeedPullToRefreshEnabled(alsoEnabled = false): boolean {
  const [enabled, setEnabled] = useState(
    () => alsoEnabled || matchesFeedPullToRefreshTarget(),
  );

  useEffect(() => {
    if (alsoEnabled) {
      setEnabled(true);
      return;
    }

    const media = window.matchMedia(COARSE_POINTER_MEDIA_QUERY);
    const syncEnabled = () => {
      setEnabled(media.matches);
    };

    syncEnabled();
    media.addEventListener('change', syncEnabled);
    return () => {
      media.removeEventListener('change', syncEnabled);
    };
  }, [alsoEnabled]);

  return enabled;
}

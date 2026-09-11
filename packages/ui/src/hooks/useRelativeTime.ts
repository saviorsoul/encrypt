import { useEffect, useState } from 'react';
import {
  formatRelativeTime,
  type FormatRelativeTimeOptions,
} from '../utils/formatRelativeTime.ts';

export function useRelativeTime(
  timestamp: number,
  options: FormatRelativeTimeOptions = {},
): string {
  const [now, setNow] = useState(() => Date.now());
  const omitSeconds = options.omitSeconds ?? false;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return formatRelativeTime(timestamp, now, { omitSeconds });
}

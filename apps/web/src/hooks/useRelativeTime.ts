import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/utils/formatRelativeTime.ts';

export function useRelativeTime(timestamp: number): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return formatRelativeTime(timestamp, now);
}

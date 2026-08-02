import { useEffect, useState } from 'react';
import { randomIntBetween } from '@/lib/cryptoRandom.ts';

type UseRandomBlinkOptions = {
  minMs?: number;
  maxMs?: number;
  enabled?: boolean;
};

type UseRandomBlinkResult = {
  ref: (element: HTMLElement | null) => void;
  visible: boolean;
};

export function useRandomBlink({
  minMs = 120,
  maxMs = 900,
  enabled = true,
}: UseRandomBlinkOptions = {}): UseRandomBlinkResult {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [inViewport, setInViewport] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInViewport(entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  const shouldBlink = enabled && inViewport;

  useEffect(() => {
    if (!shouldBlink) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleToggle = () => {
      timeoutId = setTimeout(
        () => {
          setVisible((current) => !current);
          scheduleToggle();
        },
        randomIntBetween(minMs, maxMs),
      );
    };

    scheduleToggle();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [shouldBlink, minMs, maxMs]);

  return {
    ref: setElement,
    visible: !enabled || !inViewport || visible,
  };
}

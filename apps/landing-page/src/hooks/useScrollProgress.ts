import { useEffect, useState } from 'react';

export function useScrollProgress(
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateProgress = () => {
      const scrollableDistance = container.offsetHeight - window.innerHeight;
      if (scrollableDistance <= 0) {
        setProgress(1);
        return;
      }

      const scrolled = -container.getBoundingClientRect().top;
      const nextProgress = Math.min(
        1,
        Math.max(0, scrolled / scrollableDistance),
      );
      setProgress(nextProgress);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [containerRef]);

  return progress;
}

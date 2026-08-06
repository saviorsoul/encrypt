import type { ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

const NBSP = '\u00A0';

type PaintHighlightProps = {
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  attachSpace?: 'before' | 'after' | 'both';
};

export function PaintHighlight({
  children,
  className,
  highlightClassName = 'text-brand',
  attachSpace,
}: PaintHighlightProps) {
  const spaceBefore = attachSpace === 'before' || attachSpace === 'both';
  const spaceAfter = attachSpace === 'after' || attachSpace === 'both';

  return (
    <>
      {spaceBefore ? NBSP : null}
      <mark
        className={cn(
          'relative inline-block whitespace-nowrap bg-transparent',
          className,
        )}
      >
        <svg
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-[-0.06em] left-1/2 block h-[1.1em] w-[calc(100%+0.4em)] -translate-x-1/2 -rotate-1',
            highlightClassName,
          )}
          preserveAspectRatio="none"
          viewBox="0 0 100 28"
        >
          <path
            d="M1.5 10.5C4.5 5.5 18 6.5 48 7.5L90 6.5C96.5 6 99.5 11.5 98.5 17.5C97.5 23.5 92 25 80 24.5L16 23.5C5.5 23 0.5 18.5 1.5 10.5Z"
            fill="currentColor"
            opacity="0.42"
          />
          <path
            d="M4 13.5C8 10.5 24 11.5 52 12L88 11.5C93.5 11 95.5 15 94.5 19C93.5 22.5 88.5 23.5 72 23L22 22.5C10.5 22 5.5 18.5 4 13.5Z"
            fill="currentColor"
            opacity="0.22"
          />
        </svg>
        {children}
      </mark>
      {spaceAfter ? NBSP : null}
    </>
  );
}

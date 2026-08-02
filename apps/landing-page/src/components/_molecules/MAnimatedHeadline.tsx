import type { ReactNode } from 'react';
import { Headline } from '@/components/_atoms/AHeadline.tsx';
import { cn } from '@/lib/cn.ts';

type AnimatedHeadlineProps = {
  children: ReactNode;
  opacity: number;
  scale: number;
  blur: number;
  positioned?: boolean;
  className?: string;
  'aria-hidden'?: boolean;
};

export function AnimatedHeadline({
  children,
  opacity,
  scale,
  blur,
  positioned = false,
  className,
  'aria-hidden': ariaHidden,
}: AnimatedHeadlineProps) {
  return (
    <Headline
      aria-hidden={ariaHidden}
      className={cn(
        positioned ? 'absolute inset-x-6 top-1/2 -translate-y-1/2' : undefined,
        className,
      )}
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </Headline>
  );
}

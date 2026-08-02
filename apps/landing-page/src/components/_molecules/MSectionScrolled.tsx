import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';
import { useScrollProgress } from '@/hooks/useScrollProgress.ts';

const DEFAULT_SCROLL_DISTANCE = '400vh';
const DEFAULT_SECTION_CLASS = 'relative';
const DEFAULT_CONTAINER_CLASS =
  'sticky top-0 flex h-svh items-center justify-center';

type SectionScrolledProps = {
  children: (progress: number) => ReactNode;
  scrollDistance?: string;
  className?: string;
  containerClassName?: string;
  'aria-label'?: string;
};

export function SectionScrolled({
  children,
  scrollDistance = DEFAULT_SCROLL_DISTANCE,
  className,
  containerClassName,
  'aria-label': ariaLabel,
}: SectionScrolledProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useScrollProgress(sectionRef);

  return (
    <section
      ref={sectionRef}
      aria-label={ariaLabel}
      className={cn(DEFAULT_SECTION_CLASS, className)}
      style={{ height: scrollDistance }}
    >
      <div className={cn(DEFAULT_CONTAINER_CLASS, containerClassName)}>
        {children(progress)}
      </div>
    </section>
  );
}

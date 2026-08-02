import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

export const DEFAULT_SECTION_CLASS = 'px-6 py-24 sm:py-32';
export const DEFAULT_CONTAINER_CLASS = 'mx-auto max-w-2xl';

type SectionProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
  'aria-label'?: string;
};

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    children,
    className,
    containerClassName,
    style,
    containerStyle,
    'aria-label': ariaLabel,
  },
  ref,
) {
  return (
    <section
      ref={ref}
      aria-label={ariaLabel}
      className={cn(DEFAULT_SECTION_CLASS, className)}
      style={style}
    >
      <div
        className={cn(DEFAULT_CONTAINER_CLASS, containerClassName)}
        style={containerStyle}
      >
        {children}
      </div>
    </section>
  );
});

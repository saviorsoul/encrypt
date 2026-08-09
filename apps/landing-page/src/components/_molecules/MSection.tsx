import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

export const DEFAULT_SECTION_CLASS = 'px-6 py-24 sm:py-32';
export const DEFAULT_CONTAINER_CLASS = 'mx-auto max-w-2xl';

const SECTION_HEIGHT_CLASS = {
  viewport: 'min-h-svh',
  content: '',
} as const;

export type SectionHeight = keyof typeof SECTION_HEIGHT_CLASS;

type SectionProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  height?: SectionHeight;
  style?: CSSProperties;
  containerStyle?: CSSProperties;
  'aria-label'?: string;
};

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    children,
    className,
    containerClassName,
    height = 'viewport',
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
      className={cn(
        DEFAULT_SECTION_CLASS,
        SECTION_HEIGHT_CLASS[height],
        className,
      )}
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

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type HeadingProps = {
  level: HeadingLevel;
  children: ReactNode;
  className?: string;
  visuallyHidden?: boolean;
} & Omit<ComponentPropsWithoutRef<'h1'>, 'children' | 'className'>;

const HEADING_TAGS = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const;

const HEADING_STYLES: Record<HeadingLevel, string> = {
  1: 'text-4xl font-bold tracking-tight',
  2: 'text-3xl font-bold',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-semibold',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
};

export function Heading({
  level,
  children,
  className,
  visuallyHidden = false,
  ...props
}: HeadingProps) {
  const Tag = HEADING_TAGS[level];

  return (
    <Tag
      className={cn(
        HEADING_STYLES[level],
        visuallyHidden && 'sr-only',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

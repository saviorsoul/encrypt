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

export function Heading({
  level,
  children,
  className,
  visuallyHidden = false,
  ...props
}: HeadingProps) {
  const Tag = HEADING_TAGS[level];

  return (
    <Tag className={cn(visuallyHidden && 'sr-only', className)} {...props}>
      {children}
    </Tag>
  );
}

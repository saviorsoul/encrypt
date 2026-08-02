import type { CSSProperties, ReactNode } from 'react';

type HeadlineProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
};

export function Headline({
  children,
  className = '',
  style,
  'aria-hidden': ariaHidden,
}: HeadlineProps) {
  return (
    <p
      aria-hidden={ariaHidden}
      className={`text-5xl leading-tight font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl ${className}`}
      style={style}
    >
      {children}
    </p>
  );
}

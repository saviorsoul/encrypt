import { AccentHeadlineText } from '@/components/_molecules/MAccentHeadlineText.tsx';
import { cn } from '@/lib/cn.ts';

type FeedntTextProps = {
  className?: string;
  blinkApostrophe?: boolean;
};

export function FeedntText({
  className,
  blinkApostrophe = true,
}: FeedntTextProps) {
  return (
    <AccentHeadlineText
      blinkApostrophe={blinkApostrophe}
      className={cn('text-brand', className)}
      text="Feedn't"
    />
  );
}

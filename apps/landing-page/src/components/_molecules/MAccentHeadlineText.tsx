import { useRandomBlink } from '@/hooks/useRandomBlink.ts';

type AccentHeadlineTextProps = {
  text: string;
  className?: string;
  blinkApostrophe?: boolean;
};

export function AccentHeadlineText({
  text,
  className,
  blinkApostrophe = true,
}: AccentHeadlineTextProps) {
  const apostropheIndex = text.indexOf("'");
  const { ref, visible: apostropheVisible } = useRandomBlink({
    enabled: blinkApostrophe && apostropheIndex !== -1,
  });

  if (apostropheIndex === -1) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        <span className={className}>{text.slice(0, apostropheIndex)}</span>
        <span className={apostropheVisible ? undefined : 'opacity-0'}>
          {text[apostropheIndex]}
        </span>
        <span className={className}>{text.slice(apostropheIndex + 1)}</span>
      </span>
    </span>
  );
}

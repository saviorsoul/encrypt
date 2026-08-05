import { cn } from '@/lib/cn.ts';

const LETTER_COLORS = [
  'text-brand',
  'text-cyan-300',
  'text-sky-400',
  'text-violet-400',
  'text-fuchsia-400',
  'text-rose-400',
  'text-amber-300',
] as const;

type ColorfulWordProps = {
  children: string;
  className?: string;
};

export function ColorfulWord({ children, className }: ColorfulWordProps) {
  const letters = [...children];

  return (
    <span className={className}>
      {letters.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={cn(LETTER_COLORS[index % LETTER_COLORS.length])}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}

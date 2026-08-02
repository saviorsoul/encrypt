import { BulletItem } from '@/components/_molecules/MBulletItem.tsx';

type BulletListProps = {
  items: readonly string[];
};

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-6 text-lg leading-relaxed text-neutral-400">
      {items.map((text) => (
        <BulletItem key={text}>{text}</BulletItem>
      ))}
    </ul>
  );
}

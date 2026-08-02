import { BulletMarker } from '@/components/_atoms/ABulletMarker.tsx';

type BulletItemProps = {
  children: string;
};

export function BulletItem({ children }: BulletItemProps) {
  return (
    <li className="flex gap-4">
      <BulletMarker />
      <span>{children}</span>
    </li>
  );
}

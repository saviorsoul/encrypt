import { PaintHighlight } from '@/components/_atoms/APaintHighlight.tsx';

type NotStatementProps = {
  children: string;
};

export function NotStatement({ children }: NotStatementProps) {
  return (
    <p>
      <PaintHighlight className="font-semibold text-brand">Not</PaintHighlight>{' '}
      {children}
    </p>
  );
}

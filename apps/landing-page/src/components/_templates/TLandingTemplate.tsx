import type { ReactNode } from 'react';

type LandingTemplateProps = {
  hero: ReactNode;
  children: ReactNode;
};

export function LandingTemplate({ hero, children }: LandingTemplateProps) {
  return (
    <main>
      {hero}
      {children}
    </main>
  );
}

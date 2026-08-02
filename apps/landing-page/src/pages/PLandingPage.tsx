import { ContentSection } from '@/components/_organisms/OContentSection.tsx';
import { ContentSection as ContentSection2 } from '@/components/_organisms/OContentSection2.tsx';
import { HeroSection } from '@/components/_organisms/OHeroSection.tsx';

export function LandingPage() {
  return (
    <main>
      <HeroSection />
      <ContentSection />
      <ContentSection2 />
    </main>
  );
}

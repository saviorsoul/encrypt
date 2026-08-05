import { AboutFeedntSection } from '@/components/_organisms/OAboutFeedntSection.tsx';
import { SeeYouSoonSection } from '@/components/_organisms/OSeeYouSoonSection.tsx';
import { WhatFeedntIsNotSection } from '@/components/_organisms/OWhatFeedntIsNotSection.tsx';
import { WhatFeedntIsSection } from '@/components/_organisms/OWhatFeedntIsSection.tsx';
import { HeroSection } from '@/components/_organisms/OHeroSection.tsx';

export function LandingPage() {
  return (
    <main>
      <HeroSection />
      <WhatFeedntIsNotSection />
      <WhatFeedntIsSection />
      <AboutFeedntSection />
      <SeeYouSoonSection />
    </main>
  );
}

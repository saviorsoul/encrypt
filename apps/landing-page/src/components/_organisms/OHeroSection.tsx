import { ScrollHint } from '@/components/_atoms/AScrollHint.tsx';
import { ScrollMorphText } from '@/components/_molecules/MScrollMorphText.tsx';
import { SectionScrolled } from '@/components/_molecules/MSectionScrolled.tsx';

export function HeroSection() {
  return (
    <SectionScrolled aria-label="Hero">
      {(progress) => (
        <>
          <ScrollMorphText progress={progress} />
          <ScrollHint opacity={1 - progress} />
        </>
      )}
    </SectionScrolled>
  );
}

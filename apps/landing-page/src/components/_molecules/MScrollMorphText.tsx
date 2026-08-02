import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { AnimatedHeadline } from '@/components/_molecules/MAnimatedHeadline.tsx';
import { Heading } from '@/components/_atoms/AHeading.tsx';
import { easeInOutCubic } from '@/lib/easing.ts';

const FROM_TEXT = 'Stop feeding them';
const TO_TEXT = "Feedn't";

type ScrollMorphTextProps = {
  progress: number;
};

const FROM_FADE_END = 0.55;

export function ScrollMorphText({ progress }: ScrollMorphTextProps) {
  const easedProgress = easeInOutCubic(progress);
  const fromFadeProgress = easeInOutCubic(
    Math.min(1, progress / FROM_FADE_END),
  );
  const fromOpacity = 1 - fromFadeProgress;
  const toOpacity = easedProgress;
  const fromScale = 1 - fromFadeProgress * 0.04;
  const toScale = 0.96 + easedProgress * 0.04;
  const fromBlur = fromFadeProgress * 6;
  const toBlur = (1 - easedProgress) * 6;

  return (
    <div className="relative w-full max-w-5xl px-6 text-center">
      <AnimatedHeadline
        aria-hidden
        blur={fromBlur}
        opacity={fromOpacity}
        positioned
        scale={fromScale}
      >
        {FROM_TEXT}
      </AnimatedHeadline>
      <AnimatedHeadline
        aria-hidden
        blur={toBlur}
        opacity={toOpacity}
        scale={toScale}
      >
        <FeedntText />
      </AnimatedHeadline>
      <Heading level={1} visuallyHidden>
        {FROM_TEXT}. {TO_TEXT}.
      </Heading>
    </div>
  );
}

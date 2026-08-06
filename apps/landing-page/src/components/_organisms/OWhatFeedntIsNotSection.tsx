import { Heading } from '@/components/_atoms/AHeading.tsx';
import { PaintHighlight } from '@/components/_atoms/APaintHighlight.tsx';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';

const NOT_STATEMENTS = [
  'a feed app that is selling your attention.',
  'a company that wants to know you better.',
  'a product that hides from you what it does.',
] as const;

export function WhatFeedntIsNotSection() {
  return (
    <Section containerClassName="grid gap-y-12">
      <div>
        <Heading className="text-center" level={2}>
          What <FeedntText /> is not
        </Heading>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-4 text-2xl md:grid-cols-3">
        {NOT_STATEMENTS.map((statement) => (
          <p key={statement}>
            <PaintHighlight
              attachSpace="after"
              className="font-semibold text-brand"
            >
              Not
            </PaintHighlight>
            {statement}
          </p>
        ))}
      </div>
    </Section>
  );
}

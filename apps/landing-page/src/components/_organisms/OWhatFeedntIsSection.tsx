import { Heading } from '@/components/_atoms/AHeading.tsx';
import { PaintHighlight } from '@/components/_atoms/APaintHighlight.tsx';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';

export function WhatFeedntIsSection() {
  return (
    <Section containerClassName="grid gap-y-12">
      <div>
        <Heading className="text-center" level={2}>
          What <FeedntText /> is
        </Heading>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-4 text-2xl md:grid-cols-3">
        <p>
          An{' '}
          <PaintHighlight className="font-semibold text-brand">
            ethical
          </PaintHighlight>{' '}
          answer to predatory social monetization.
        </p>
        <p>
          A tool that knows almost{' '}
          <PaintHighlight className="font-semibold text-brand">
            nothing
          </PaintHighlight>{' '}
          about you, by design.
        </p>
        <p>
          An{' '}
          <PaintHighlight className="font-semibold text-brand">
            open-source
          </PaintHighlight>{' '}
          app that helps you{' '}
          <PaintHighlight className="font-semibold text-brand">
            encrypt
          </PaintHighlight>{' '}
          your messages.
        </p>
      </div>
    </Section>
  );
}

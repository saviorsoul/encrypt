import { Heading } from '@/components/_atoms/AHeading.tsx';
import { PaintHighlight } from '@/components/_atoms/APaintHighlight.tsx';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';

export function ContentSection() {
  return (
    <Section containerClassName="grid gap-y-12">
      <div>
        <Heading className="text-center text-3xl font-bold" level={2}>
          What <FeedntText /> actually is?
        </Heading>
      </div>

      <div className="grid grid-cols-1 gap-x-12 gap-y-4 text-2xl md:grid-cols-3">
        <p>
          <PaintHighlight className="font-semibold text-brand">
            Community
          </PaintHighlight>{' '}
          who cares about one another.
        </p>
        <p>
          A tool which knows hardly{' '}
          <PaintHighlight className="font-semibold text-brand">
            nothing
          </PaintHighlight>{' '}
          about you, by design.
        </p>
        <p>
          <PaintHighlight className="font-semibold text-brand">
            Open-source
          </PaintHighlight>{' '}
          app which helps you to{' '}
          <PaintHighlight className="font-semibold text-brand">
            encrypt
          </PaintHighlight>{' '}
          your messages.
        </p>
      </div>
    </Section>
  );
}

import { Heading } from '@/components/_atoms/AHeading.tsx';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';
import {
  BETA_DATA_REMOVAL_NOTICE,
  BETA_END_DATE_LABEL,
  isBetaPeriodActive,
} from '@/lib/betaTest.ts';
import {
  DISCORD_INVITE_URL,
  FEEDNT_TEST_URL,
  GITHUB_RELEASES_URL,
} from '@/lib/links.ts';

const linkClassName =
  'font-semibold text-brand underline-offset-4 transition-colors hover:text-brand/80 underline';

export function BetaTestSection() {
  if (!isBetaPeriodActive()) {
    return null;
  }

  return (
    <Section containerClassName="grid gap-y-6 text-center">
      <Heading level={2}>Open beta test</Heading>
      <p className="text-lg leading-relaxed text-neutral-200">
        <FeedntText /> is in open beta until {BETA_END_DATE_LABEL}.{' '}
        {BETA_DATA_REMOVAL_NOTICE}
      </p>
      <p className="text-lg leading-relaxed text-neutral-200">
        Try it on{' '}
        <a
          className={linkClassName}
          href={FEEDNT_TEST_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          test.feednt.com
        </a>
        , download the{' '}
        <a
          className={linkClassName}
          href={GITHUB_RELEASES_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          system app
        </a>
        , or join us on{' '}
        <a
          className={linkClassName}
          href={DISCORD_INVITE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Discord
        </a>{' '}
        to get an invitation.
      </p>
    </Section>
  );
}

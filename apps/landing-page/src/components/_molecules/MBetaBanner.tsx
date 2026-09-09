import { useState } from 'react';
import { FEEDNT_TEST_URL, GITHUB_RELEASES_URL } from '@/lib/links.ts';
import { BETA_END_DATE_LABEL, isBetaPeriodActive } from '@/lib/betaTest.ts';
import { cn } from '@/lib/cn.ts';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';

const linkClassName =
  'font-semibold text-brand underline-offset-4 transition-colors hover:text-brand/80 underline';

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!isBetaPeriodActive() || dismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Beta announcement"
      className="fixed inset-x-0 top-0 z-50 border-b border-brand/25 bg-neutral-900/95 px-4 py-2.5 text-sm text-neutral-100 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3 sm:items-center">
        <div className="flex-1 text-center leading-snug">
          <p>
            <FeedntText /> is in open beta until {BETA_END_DATE_LABEL}.
          </p>
          <p className="mt-3">
            <a
              className={linkClassName}
              href={GITHUB_RELEASES_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Download
            </a>{' '}
            system app or check how it works on{' '}
            <a
              className={linkClassName}
              href={FEEDNT_TEST_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              test.feednt.com
            </a>
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss beta announcement"
          className={cn(
            'shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 text-2xl leading-none text-neutral-400',
            'transition-colors hover:bg-neutral-800 hover:text-neutral-100',
          )}
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

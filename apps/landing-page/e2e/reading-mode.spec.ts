import { expect, test } from '@playwright/test';
import {
  hasOrphanedLeadingSpaceOnWrappedLine,
  normalizeReaderText,
} from './helpers/readerText.ts';

function whatFeedntIsSection(page: import('@playwright/test').Page) {
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: "What Feedn't is", exact: true }),
  });
}

test.describe('landing page reading mode text', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('extracts main prose with section headings and body copy', async ({
    page,
  }) => {
    const text = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!(main instanceof HTMLElement)) {
        return '';
      }

      const clone = main.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('[aria-hidden="true"], .scroll-decorative')
        .forEach((node) => {
          node.remove();
        });

      return clone.innerText;
    });

    const normalizedText = normalizeReaderText(text);

    expect(normalizedText).toContain("What Feedn't is not");
    expect(normalizedText).toContain(
      'Not a feed app that is selling your attention.',
    );
    expect(normalizedText).toContain("What Feedn't is");
    expect(normalizedText).toContain(
      'An ethical answer to predatory social networks monetization.',
    );
    expect(normalizedText).toContain(
      'A tool that knows almost nothing about you',
    );
    expect(normalizedText).toContain(
      'An open-source app that helps you encrypt your messages.',
    );
    expect(normalizedText).toContain(
      'Enough commercials, what is it all about?',
    );
    expect(normalizedText).toContain(
      "The n't part in the name is to describe that you",
    );
    expect(normalizedText).not.toContain("n'tn't");
    expect(normalizedText).not.toContain("Feedn'tFeedn't");
  });

  test('does not glue or split highlighted phrases in narrow reader layout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });

    const text = await whatFeedntIsSection(page)
      .locator('p')
      .first()
      .innerText();

    expect(text).toMatch(/An\s+ethical answer/);
    expect(text).not.toContain('Anethical');
    expect(hasOrphanedLeadingSpaceOnWrappedLine(text)).toBe(false);
  });
});

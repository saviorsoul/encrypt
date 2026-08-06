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

test.describe('landing page rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders highlighted value statements with correct spacing', async ({
    page,
  }) => {
    const section = whatFeedntIsSection(page);

    await expect(
      section.getByRole('heading', { name: "What Feedn't is", exact: true }),
    ).toBeVisible();
    await expect(section.locator('p').nth(0)).toContainText(
      'An ethical answer to predatory social networks monetization.',
    );
    await expect(section.locator('p').nth(1)).toContainText(
      'A tool that knows almost nothing about you, by design.',
    );
    await expect(section.locator('p').nth(2)).toContainText(
      'An open-source app that helps you encrypt your messages.',
    );
  });

  test('does not orphan a leading space when a highlight wraps', async ({
    page,
  }) => {
    const paragraph = whatFeedntIsSection(page).locator('p').first();

    for (const width of [280, 320, 360, 480, 640]) {
      await page.setViewportSize({ width, height: 900 });

      const text = normalizeReaderText(await paragraph.innerText());

      expect(text).toBe(
        'An ethical answer to predatory social networks monetization.',
      );
      expect(hasOrphanedLeadingSpaceOnWrappedLine(text)).toBe(false);
    }
  });

  test('keeps highlight paint inside the marked word only', async ({
    page,
  }) => {
    const mark = whatFeedntIsSection(page)
      .locator('mark', { hasText: 'ethical' })
      .first();

    await expect(mark).toBeVisible();
    await expect(mark).toHaveText('ethical');

    const paragraphText = normalizeReaderText(
      await mark.locator('xpath=ancestor::p[1]').innerText(),
    );

    expect(paragraphText).toBe(
      'An ethical answer to predatory social networks monetization.',
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILE_SELECTION_CANCELLED,
  pickPrivateKeyJwkFileWithName,
} from '@encrypt/platform/privateKeyJwkPickers';

const TEST_PRIVATE_KEY_JSON = JSON.stringify({
  kty: 'EC',
  crv: 'P-256',
  x: 'WKn-ZIGevcwGIkkrzFOodl_yv6QuesZMW9nos3nzYiCE',
  y: 'AL9XP-DVF0E_xYZ3g-jXG-Y_6wk0EnWN0aZ8GWLNPQ8',
  d: '0HhSk7Q9E8jVaAfGK8p0G8si1RZcXwHLjG247wp8YB5M',
});

function setNavigator(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): void {
  vi.stubGlobal('navigator', {
    userAgent,
    platform,
    maxTouchPoints,
  });
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected a hidden file input.');
  }
  return input;
}

function assignFileToInput(input: HTMLInputElement, contents: string): File {
  const file = new File([contents], 'test-private-key.json', {
    type: 'application/json',
  });
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
  });
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: {
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      0: file,
    },
  });
  return file;
}

describe('pickPrivateKeyJwkFileWithName', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setNavigator(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Win32',
      0,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('rejects when the file input cancel event fires', async () => {
    const promise = pickPrivateKeyJwkFileWithName();
    getFileInput().dispatchEvent(new Event('cancel', { bubbles: true }));

    await expect(promise).rejects.toThrow(FILE_SELECTION_CANCELLED);
  });

  it('does not reject on iOS when focus returns before the change event', async () => {
    vi.useFakeTimers();
    setNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      'iPhone',
      5,
    );

    const promise = pickPrivateKeyJwkFileWithName();
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(500);

    const input = getFileInput();
    assignFileToInput(input, TEST_PRIVATE_KEY_JSON);
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await expect(promise).resolves.toMatchObject({
      fileName: 'test-private-key.json',
    });
  });

  it('resolves when a file is selected', async () => {
    const promise = pickPrivateKeyJwkFileWithName();
    const input = getFileInput();
    assignFileToInput(input, TEST_PRIVATE_KEY_JSON);
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await expect(promise).resolves.toMatchObject({
      fileName: 'test-private-key.json',
    });
  });
});

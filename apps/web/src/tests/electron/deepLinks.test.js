import { describe, expect, it } from 'vitest';
import {
  buildDeepLink,
  findDeepLinkInArgv,
  parseDeepLink,
} from '../../../electron/deepLinks.js';

describe('parseDeepLink', () => {
  it('parses copy-public-key', () => {
    expect(parseDeepLink('encrypt://copy-public-key')).toEqual({
      ok: true,
      action: { type: 'copy-public-key' },
    });
  });

  it('rejects removed encrypt://show', () => {
    expect(parseDeepLink('encrypt://show').ok).toBe(false);
  });

  it('parses encrypt with text', () => {
    expect(parseDeepLink('encrypt://encrypt?text=hello')).toEqual({
      ok: true,
      action: { type: 'encrypt', text: 'hello' },
    });
  });

  it('rejects encrypt to= param', () => {
    expect(parseDeepLink('encrypt://encrypt?text=hello&to=alice').ok).toBe(
      false,
    );
  });

  it('parses decrypt text', () => {
    expect(parseDeepLink('encrypt://decrypt?text=%7B%22a%22%3A1%7D')).toEqual({
      ok: true,
      action: { type: 'decrypt', text: '{"a":1}' },
    });
  });

  it('rejects removed encrypt://import', () => {
    expect(parseDeepLink('encrypt://import?text=%7B%22a%22%3A1%7D').ok).toBe(
      false,
    );
  });

  it('rejects empty encrypt text', () => {
    expect(parseDeepLink('encrypt://encrypt?text=').ok).toBe(false);
  });

  it('accepts long encrypt text', () => {
    const longText = 'x'.repeat(10_000);
    expect(parseDeepLink(buildDeepLink('encrypt', { text: longText }))).toEqual(
      {
        ok: true,
        action: { type: 'encrypt', text: longText },
      },
    );
  });

  it('rejects unknown actions and params', () => {
    expect(parseDeepLink('encrypt://nope').ok).toBe(false);
    expect(parseDeepLink('encrypt://encrypt?text=hi&extra=1').ok).toBe(false);
  });
});

describe('findDeepLinkInArgv', () => {
  it('finds the protocol URL among argv', () => {
    expect(
      findDeepLinkInArgv([
        'electron',
        'encrypt://encrypt?text=hi',
        '/some/file.json',
      ]),
    ).toBe('encrypt://encrypt?text=hi');
  });

  it('finds quoted or embedded protocol URLs', () => {
    expect(
      findDeepLinkInArgv([
        '/opt/Encrypt/encrypt',
        "'encrypt://copy-public-key'",
      ]),
    ).toBe('encrypt://copy-public-key');
    expect(findDeepLinkInArgv(['something=encrypt://copy-public-key'])).toBe(
      'encrypt://copy-public-key',
    );
  });
});

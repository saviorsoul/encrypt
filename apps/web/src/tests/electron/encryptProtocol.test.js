import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildDeepLink,
  findDeepLinkInArgv,
  parseDeepLink,
} from '../../../electron/deepLinks.js';

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'),
);
const mainJs = fs.readFileSync(path.join(webRoot, 'electron/main.js'), 'utf8');

describe('encrypt:// protocol registration (packaging)', () => {
  it('declares the encrypt scheme for electron-builder', () => {
    const protocols = packageJson.build?.protocols;
    expect(Array.isArray(protocols)).toBe(true);
    expect(protocols.some((p) => p.schemes?.includes('encrypt'))).toBe(true);
  });

  it('registers x-scheme-handler/encrypt on Linux desktop entry', () => {
    const mimeType = packageJson.build?.linux?.desktop?.entry?.MimeType ?? '';
    expect(mimeType).toContain('x-scheme-handler/encrypt');
  });

  it('calls setAsDefaultProtocolClient in Electron main', () => {
    expect(mainJs).toContain("PROTOCOL_SCHEME = 'encrypt'");
    expect(mainJs).toContain('setAsDefaultProtocolClient');
    expect(mainJs).toContain('findDeepLinkInArgv');
    expect(mainJs).toContain("app.on('open-url'");
    expect(mainJs).toContain("app.on('second-instance'");
    expect(mainJs).toContain('deep-link:action-request');
    expect(mainJs).toContain('isDefaultProtocolClient');
  });
});

describe('encrypt:// deep link contract', () => {
  it('round-trips buildDeepLink through parseDeepLink', () => {
    const cases = [
      buildDeepLink('copy-public-key'),
      buildDeepLink('encrypt', { text: 'hello world' }),
      buildDeepLink('decrypt', { text: '{"v":1}' }),
    ];

    for (const href of cases) {
      expect(href.startsWith('encrypt://')).toBe(true);
      const parsed = parseDeepLink(href);
      expect(parsed.ok).toBe(true);
    }
  });

  it('accepts protocol launch argv the way the OS passes it', () => {
    const href = buildDeepLink('encrypt', { text: 'from-os' });
    expect(findDeepLinkInArgv(['/opt/Encrypt/encrypt', href])).toBe(href);
    expect(parseDeepLink(href)).toEqual({
      ok: true,
      action: { type: 'encrypt', text: 'from-os' },
    });
  });
});

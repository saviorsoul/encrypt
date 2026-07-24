import { describe, expect, it } from 'vitest';
import {
  isLinuxEncryptProtocolDefault,
  LINUX_PROTOCOL_DESKTOP_ENTRY,
} from '../../../electron/protocolHandlerLinux.js';

describe('protocolHandlerLinux', () => {
  it('accepts the desktop entry id', () => {
    expect(isLinuxEncryptProtocolDefault(LINUX_PROTOCOL_DESKTOP_ENTRY)).toBe(
      true,
    );
  });

  it('accepts an absolute desktop file path', () => {
    expect(
      isLinuxEncryptProtocolDefault(
        `/usr/share/applications/${LINUX_PROTOCOL_DESKTOP_ENTRY}`,
      ),
    ).toBe(true);
  });

  it('rejects other handlers', () => {
    expect(isLinuxEncryptProtocolDefault('evil.desktop')).toBe(false);
    expect(isLinuxEncryptProtocolDefault(null)).toBe(false);
  });
});

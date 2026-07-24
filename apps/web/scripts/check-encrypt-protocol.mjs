#!/usr/bin/env node
/**
 * Smoke-check that the encrypt:// protocol is wired for packaging and,
 * when possible, registered with the OS.
 *
 * Usage:
 *   node apps/web/scripts/check-encrypt-protocol.mjs
 *   REQUIRE_OS_HANDLER=1 node apps/web/scripts/check-encrypt-protocol.mjs
 *
 * REQUIRE_OS_HANDLER=1 fails if the OS has no handler (useful after install).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDeepLink,
  parseDeepLink,
} from '../electron/deepLinks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const requireOsHandler = process.env.REQUIRE_OS_HANDLER === '1';

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];

function pass(message) {
  console.log(`ok  - ${message}`);
}

function fail(message) {
  errors.push(message);
  console.error(`FAIL - ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`warn - ${message}`);
}

function checkPackaging() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'),
  );
  const schemes = (pkg.build?.protocols ?? []).flatMap((p) => p.schemes ?? []);
  if (schemes.includes('encrypt')) {
    pass('electron-builder protocols includes encrypt');
  } else {
    fail('electron-builder protocols missing encrypt scheme');
  }

  const mime = pkg.build?.linux?.desktop?.entry?.MimeType ?? '';
  if (mime.includes('x-scheme-handler/encrypt')) {
    pass('Linux desktop MimeType includes x-scheme-handler/encrypt');
  } else {
    fail('Linux desktop MimeType missing x-scheme-handler/encrypt');
  }

  const mainJs = fs.readFileSync(path.join(webRoot, 'electron/main.js'), 'utf8');
  if (mainJs.includes('setAsDefaultProtocolClient')) {
    pass('Electron main registers setAsDefaultProtocolClient');
  } else {
    fail('Electron main missing setAsDefaultProtocolClient');
  }

  if (mainJs.includes('isDefaultProtocolClient')) {
    pass('Electron main checks isDefaultProtocolClient');
  } else {
    fail('Electron main missing isDefaultProtocolClient check');
  }

  if (mainJs.includes('protocolHandlerLinux.js')) {
    pass('Electron main uses Linux xdg-mime protocol handler helpers');
  } else {
    fail('Electron main missing Linux protocol handler helpers');
  }
}

function checkDeepLinkContract() {
  const href = buildDeepLink('copy-public-key');
  const parsed = parseDeepLink(href);
  if (parsed.ok && parsed.action.type === 'copy-public-key') {
    pass(`deep link parse works for ${href}`);
  } else {
    fail(`deep link parse failed for ${href}`);
  }

  const removed = parseDeepLink('encrypt://show');
  if (!removed.ok) {
    pass('encrypt://show is rejected (removed action)');
  } else {
    fail('encrypt://show should be rejected');
  }
}

function tryCommand(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function checkOsHandler() {
  if (process.platform === 'linux') {
    const mimeDefault = tryCommand('xdg-mime', [
      'query',
      'default',
      'x-scheme-handler/encrypt',
    ]);
    if (mimeDefault) {
      pass(`xdg-mime default handler: ${mimeDefault}`);
    } else {
      const message =
        'OS has no x-scheme-handler/encrypt (install/run packaged Encrypt once)';
      if (requireOsHandler) {
        fail(message);
      } else {
        warn(message);
      }
    }

    const desktop = '/usr/share/applications/com.encrypt.app.desktop';
    if (fs.existsSync(desktop)) {
      const text = fs.readFileSync(desktop, 'utf8');
      if (text.includes('x-scheme-handler/encrypt')) {
        pass(`installed desktop file declares scheme (${desktop})`);
      } else {
        warn(`installed desktop file missing scheme: ${desktop}`);
      }
      if (/%[uU]/.test(text)) {
        pass('installed desktop Exec passes URL (%u/%U)');
      } else {
        warn('installed desktop Exec may not receive encrypt:// URLs');
      }
    } else if (requireOsHandler) {
      fail(`missing installed desktop file: ${desktop}`);
    } else {
      warn(`packaged desktop file not found at ${desktop}`);
    }
    return;
  }

  if (process.platform === 'darwin' || process.platform === 'win32') {
    warn(
      `OS handler probe not automated on ${process.platform}; use encrypt://copy-public-key after install`,
    );
    if (requireOsHandler) {
      fail('REQUIRE_OS_HANDLER=1 is only implemented for Linux');
    }
    console.log(
      '  Hijack test (Linux): install a dummy other-app.desktop, then:',
    );
    console.log(
      '    xdg-mime default other-app.desktop x-scheme-handler/encrypt',
    );
    console.log('  Re-open packaged Encrypt — expect handler warning + Restore.');
    return;
  }

  warn(`unsupported platform for OS probe: ${process.platform}`);
}

console.log('Checking encrypt:// protocol wiring…\n');
checkPackaging();
checkDeepLinkContract();
checkOsHandler();

console.log('');
if (errors.length > 0) {
  console.error(`encrypt:// protocol check failed (${errors.length} error(s)).`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(
    `encrypt:// protocol check passed with ${warnings.length} warning(s).`,
  );
  console.log(
    'Manual browser check: open electron/protocol-test.html and click a link.',
  );
  process.exit(0);
}

console.log('encrypt:// protocol check passed.');
console.log(
  'Manual browser check: open electron/protocol-test.html and click a link.',
);

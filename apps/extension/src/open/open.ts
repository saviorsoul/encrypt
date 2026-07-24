const statusEl = document.getElementById('status');

function fail(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

/**
 * Navigate this extension page to encrypt:// so Chromium's external-protocol
 * handoff runs (tabs.create(encrypt://…) often never reaches the OS app).
 */
function handoff(): void {
  const encoded = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';
  if (!encoded) {
    fail('Missing Encrypt deep link.');
    return;
  }

  let target: string;
  try {
    target = decodeURIComponent(encoded);
  } catch {
    fail('Invalid Encrypt deep link encoding.');
    return;
  }

  if (!/^encrypt:\/\//i.test(target)) {
    fail('Not an encrypt:// link.');
    return;
  }

  // Full navigation triggers the OS protocol handler / “Open Encrypt?” prompt.
  window.location.replace(target);
}

handoff();

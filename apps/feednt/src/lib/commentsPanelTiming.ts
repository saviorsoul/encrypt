export const COMMENTS_PANEL_COLLAPSE_MS = 300;
export const COMMENTS_PANEL_CONTENT_GROW_MS = COMMENTS_PANEL_COLLAPSE_MS;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForMinDuration(
  startedAt: number,
  minMs: number,
): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await delay(remaining);
  }
}

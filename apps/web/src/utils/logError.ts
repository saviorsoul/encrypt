const loggedRoots = new WeakSet<object>();

function errorRoot(error: unknown): object {
  if (!(error instanceof Error)) {
    return typeof error === 'object' && error !== null
      ? error
      : { message: String(error) };
  }
  let current: Error = error;
  while (current.cause instanceof Error) {
    current = current.cause;
  }
  return current;
}

/**
 * Log a failure once per root error (nested catches should not spam the console).
 * No-op when the same root `error` (including via `error.cause`) was already logged.
 */
export function logError(
  phase: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  const root = errorRoot(error);
  if (loggedRoots.has(root)) {
    return;
  }
  loggedRoots.add(root);

  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error) {
    console.error(`[${phase}] ${message}`, error, details ?? {});
  } else {
    console.error(`[${phase}] ${message}`, details ?? {});
  }
}

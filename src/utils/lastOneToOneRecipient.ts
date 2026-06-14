export const ONE_TO_ONE_LAST_RECIPIENT_STORAGE_KEY =
  'social-fe-one-to-one-last-recipient';

type LastRecipientByUser = Record<string, string>;

function readLastRecipientByUser(): LastRecipientByUser {
  try {
    const raw = localStorage.getItem(ONE_TO_ONE_LAST_RECIPIENT_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const result: LastRecipientByUser = {};
    for (const [loggedInUsername, recipientUsername] of Object.entries(
      parsed,
    )) {
      if (
        typeof loggedInUsername === 'string' &&
        typeof recipientUsername === 'string' &&
        loggedInUsername &&
        recipientUsername
      ) {
        result[loggedInUsername] = recipientUsername;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLastRecipientByUser(map: LastRecipientByUser): void {
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(ONE_TO_ONE_LAST_RECIPIENT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      ONE_TO_ONE_LAST_RECIPIENT_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function loadLastOneToOneRecipientUsername(
  loggedInUsername: string,
): string | null {
  const trimmed = loggedInUsername.trim();
  if (!trimmed) {
    return null;
  }
  return readLastRecipientByUser()[trimmed] ?? null;
}

export function resolveInitialOneToOneRecipientUsername(
  loggedInUsername: string | undefined,
): string | null {
  if (!loggedInUsername) {
    return null;
  }
  return loadLastOneToOneRecipientUsername(loggedInUsername);
}

export function resolveInitialOneToOneRecipientLabel(
  loggedInUsername: string | undefined,
): string {
  return (
    resolveInitialOneToOneRecipientUsername(loggedInUsername) ?? 'Recipient'
  );
}

export function saveLastOneToOneRecipientUsername(
  loggedInUsername: string,
  recipientUsername: string,
): void {
  const trimmedLoggedIn = loggedInUsername.trim();
  const trimmedRecipient = recipientUsername.trim();
  if (!trimmedLoggedIn || !trimmedRecipient) {
    return;
  }

  const map = readLastRecipientByUser();
  map[trimmedLoggedIn] = trimmedRecipient;
  writeLastRecipientByUser(map);
}

export function clearLastOneToOneRecipientStorage(): void {
  try {
    localStorage.removeItem(ONE_TO_ONE_LAST_RECIPIENT_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy mode */
  }
}

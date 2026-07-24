export const PENDING_ONE_TO_ONE_RECIPIENT_SELECT_KEY =
  'encrypt-pending-one-to-one-recipient';

export function readPendingOneToOneRecipientSelect(): string | null {
  try {
    const value = sessionStorage.getItem(
      PENDING_ONE_TO_ONE_RECIPIENT_SELECT_KEY,
    );
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writePendingOneToOneRecipientSelect(
  username: string | null,
): void {
  try {
    if (username) {
      sessionStorage.setItem(PENDING_ONE_TO_ONE_RECIPIENT_SELECT_KEY, username);
    } else {
      sessionStorage.removeItem(PENDING_ONE_TO_ONE_RECIPIENT_SELECT_KEY);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}

export type OneToOneRecipientSelectRequest = {
  username: string;
  nonce: number;
};

export function createOneToOneRecipientSelectRequest(
  username: string,
): OneToOneRecipientSelectRequest {
  return { username, nonce: Date.now() };
}

export const ONE_TO_ONE_RECIPIENT_SELECTED_EVENT =
  'one-to-one:recipient-selected';

export type OneToOneRecipientSelectedDetail = {
  username: string;
};

export function dispatchOneToOneRecipientSelected(username: string): void {
  window.dispatchEvent(
    new CustomEvent<OneToOneRecipientSelectedDetail>(
      ONE_TO_ONE_RECIPIENT_SELECTED_EVENT,
      { detail: { username } },
    ),
  );
}

export function onOneToOneRecipientSelected(
  callback: (detail: OneToOneRecipientSelectedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    callback((event as CustomEvent<OneToOneRecipientSelectedDetail>).detail);
  };

  window.addEventListener(ONE_TO_ONE_RECIPIENT_SELECTED_EVENT, listener);

  return () => {
    window.removeEventListener(ONE_TO_ONE_RECIPIENT_SELECTED_EVENT, listener);
  };
}

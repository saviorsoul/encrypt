import type { OneToOneThreadItem } from '@/types/oneToOne.ts';

export type TrayOneToOneMessageSavedDetail = {
  item: OneToOneThreadItem;
  senderKeyId: string;
  recipientKeyId: string;
  recipientUsername: string;
  plaintext: string;
};

export const TRAY_ONE_TO_ONE_MESSAGE_SAVED_EVENT =
  'tray:one-to-one-message-saved';

export function dispatchTrayOneToOneMessageSaved(
  detail: TrayOneToOneMessageSavedDetail,
): void {
  window.dispatchEvent(
    new CustomEvent(TRAY_ONE_TO_ONE_MESSAGE_SAVED_EVENT, { detail }),
  );
}

export function onTrayOneToOneMessageSaved(
  callback: (detail: TrayOneToOneMessageSavedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    callback((event as CustomEvent<TrayOneToOneMessageSavedDetail>).detail);
  };

  window.addEventListener(TRAY_ONE_TO_ONE_MESSAGE_SAVED_EVENT, listener);

  return () => {
    window.removeEventListener(TRAY_ONE_TO_ONE_MESSAGE_SAVED_EVENT, listener);
  };
}

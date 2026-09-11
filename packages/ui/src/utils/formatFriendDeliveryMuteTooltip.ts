export type FriendDeliveryMuteState = {
  messagesMuted: boolean;
  sharesMuted: boolean;
};

export function formatFriendDeliveryMuteTooltip(
  mute: FriendDeliveryMuteState,
): string {
  const { messagesMuted, sharesMuted } = mute;

  if (messagesMuted && sharesMuted) {
    return 'You muted new messages and shares from this friend';
  }
  if (messagesMuted) {
    return 'You muted new messages from this friend';
  }
  if (sharesMuted) {
    return 'You muted new shares from this friend';
  }

  return '';
}

import type { FeedLabBridgePairing } from '@encrypt/core/feed/feedLabBridge';
import type { FeedBridgeEncryptedStorageRecord } from '@encrypt/core/feed/feedLabBridgeSessionCrypto';

const BRIDGE_CHANNEL_NAME = 'encrypt:feed-lab-bridge';

export type BridgeChannelPairMessage = {
  type: 'pair';
  sessionId: string;
  pairing?: FeedLabBridgePairing;
  error?: string;
};

export type BridgeChannelOpMessage = {
  type: 'op';
  requestId: string;
  record: FeedBridgeEncryptedStorageRecord;
};

export type BridgeChannelMessage =
  | BridgeChannelPairMessage
  | BridgeChannelOpMessage;

function postBridgeChannelMessage(message: BridgeChannelMessage): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(BRIDGE_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unavailable in this context.
  }
}

export function broadcastPairResult(
  message: Omit<BridgeChannelPairMessage, 'type'>,
): void {
  postBridgeChannelMessage({ type: 'pair', ...message });
}

export function broadcastOpResult(
  message: Omit<BridgeChannelOpMessage, 'type'>,
): void {
  postBridgeChannelMessage({ type: 'op', ...message });
}

export function subscribeBridgeChannel(
  listener: (message: BridgeChannelMessage) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  try {
    const channel = new BroadcastChannel(BRIDGE_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<BridgeChannelMessage>) => {
      listener(event.data);
    };
    return () => {
      channel.close();
    };
  } catch {
    return () => {};
  }
}

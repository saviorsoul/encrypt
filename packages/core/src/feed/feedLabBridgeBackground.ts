import { decodeFeedBridgePayload } from './feedLabBridge.ts';
import { isAutoApprovableFeedLabBridgeQuickOp } from './feedLabBridgeQuickOp.ts';

export function isBackgroundFeedLabBridgeOp(action: {
  type: string;
  op?: string;
  payload?: string;
}): boolean {
  if (
    action.type !== 'feed-op' ||
    action.op !== 'op-quick' ||
    !action.payload
  ) {
    return false;
  }

  try {
    const payload = decodeFeedBridgePayload<unknown>(action.payload);
    return isAutoApprovableFeedLabBridgeQuickOp(payload);
  } catch {
    return false;
  }
}

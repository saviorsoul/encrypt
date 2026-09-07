export const SHARE_RECIPIENTS_ALREADY_HAVE_ACCESS_MESSAGE =
  'All selected recipients already have access to this message.';

export type CreateShareResponse =
  | { id: string }
  | { recipientsAlreadyHadAccess: true };

export type CreateShareBatchItemResult =
  | ({ parentMessageId: string } & { id: string })
  | ({ parentMessageId: string } & { recipientsAlreadyHadAccess: true });

export type CreateShareBatchResponse = {
  results: CreateShareBatchItemResult[];
};

export function isCreateShareAlreadyComplete(
  response: CreateShareResponse,
): response is { recipientsAlreadyHadAccess: true } {
  return 'recipientsAlreadyHadAccess' in response;
}

export function isCreateShareBatchItemComplete(
  item: CreateShareBatchItemResult,
): item is { parentMessageId: string; recipientsAlreadyHadAccess: true } {
  return 'recipientsAlreadyHadAccess' in item;
}

export function isShareRecipientsAlreadyHaveAccessMessage(
  message: string,
): boolean {
  return (
    message === SHARE_RECIPIENTS_ALREADY_HAVE_ACCESS_MESSAGE ||
    message === 'Selected recipients already have access to this message.'
  );
}

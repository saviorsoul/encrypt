import type { QuerySchemaName } from './common.js';

export type CommentsQuery = {
  messageId: string;
};

export type InboxQuery = {
  limit: number;
  cursor?: string;
  sort: 'date';
  order: 'asc' | 'desc';
};

export type ValidatedQueryMap = {
  commentsQuery: CommentsQuery;
  inboxQuery: InboxQuery;
};

export type ValidatedQueryFor<T extends QuerySchemaName> = ValidatedQueryMap[T];

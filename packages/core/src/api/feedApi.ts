import type { KeyManifestMap } from '../types/manifest.ts';
import type { InboxApiItem, StoredComment } from '../feed/types.ts';

export type FeedApiConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export type CreateShareRequest = {
  share: Record<string, unknown>;
  keyManifest: KeyManifestMap;
  messageId: string;
  parentMessage?: Record<string, unknown>;
};

export type CreateMessageRequest = {
  version: number;
  wrap: string;
  senderPublicJwk: Record<string, unknown>;
  ephemeralPublicKey: Record<string, unknown>;
  encryptedContent: Record<string, unknown>;
  senderSignature: string;
  keyManifest: KeyManifestMap;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status}).`;
}

export function createFeedApi(config: FeedApiConfig) {
  const http = config.fetch ?? fetch;
  const baseUrl = config.baseUrl;

  return {
    async getHealth(): Promise<{ status: string }> {
      const response = await http(joinUrl(baseUrl, '/health'));
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { status: string };
    },

    async getInbox(recipientKeyId: string): Promise<InboxApiItem[]> {
      const url = new URL(joinUrl(baseUrl, '/api/inbox'));
      url.searchParams.set('recipientKeyId', recipientKeyId);
      const response = await http(url);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as InboxApiItem[];
    },

    async postMessage(body: CreateMessageRequest): Promise<{ id: string }> {
      const response = await http(joinUrl(baseUrl, '/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    async postShare(body: CreateShareRequest): Promise<{ id: string }> {
      const response = await http(joinUrl(baseUrl, '/api/shares'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    /** POST raw JSON text without client-side parsing (feed-lab / API testing). */
    async postImportBody(
      path: '/api/messages' | '/api/shares' | '/api/comments',
      body: string,
    ): Promise<{ id: string }> {
      const response = await http(joinUrl(baseUrl, path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },

    async getComments(
      messageId: string,
      recipientKeyId: string,
    ): Promise<StoredComment[]> {
      const url = new URL(joinUrl(baseUrl, '/api/comments'));
      url.searchParams.set('messageId', messageId);
      url.searchParams.set('recipientKeyId', recipientKeyId);
      const response = await http(url);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const rows = (await response.json()) as Array<{
        id: string;
        messageId: string;
        payload: string;
        createdAt: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        messageId: row.messageId,
        payload: row.payload,
        createdAt: Date.parse(row.createdAt) || Date.now(),
      }));
    },

    async postComment(
      payload: Record<string, unknown>,
    ): Promise<{ id: string }> {
      const response = await http(joinUrl(baseUrl, '/api/comments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { id: string };
    },
    /** Inbox rows plus comments for each visible thread root. */
    async getAllFeedData(recipientKeyId: string): Promise<{
      inbox: InboxApiItem[];
      commentsByMessageId: Record<string, StoredComment[]>;
    }> {
      const inbox = await this.getInbox(recipientKeyId);
      const threadIds = [
        ...new Set(
          inbox.map((item) =>
            item.type === 'share' ? (item.parentMessageId ?? item.id) : item.id,
          ),
        ),
      ];
      const commentsByMessageId: Record<string, StoredComment[]> = {};
      await Promise.all(
        threadIds.map(async (messageId) => {
          commentsByMessageId[messageId] = await this.getComments(
            messageId,
            recipientKeyId,
          );
        }),
      );
      return { inbox, commentsByMessageId };
    },
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;

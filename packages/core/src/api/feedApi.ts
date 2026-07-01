import type { KeyManifestMap } from '../types/manifest.ts';
import type { InboxApiItem, StoredComment } from '../feed/types.ts';

export type FeedApiConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export type RegisterUserRequest = {
  publicKey: string | { x: string; y: string };
};

export type BackendUser = {
  keyId: string;
  publicKey: { x: string; y: string };
};

export type CreateShareRequest = {
  share: Record<string, unknown>;
  keyManifest: KeyManifestMap;
  messageId?: string;
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

export type FriendshipRequest = {
  requesterKeyId: string;
  targetKeyId: string;
  status: 'pending' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type Friendship = {
  friendKeyId: string;
  publicKey: { x: string; y: string };
  createdAt: string;
};

export type CreateFriendshipRequestResult =
  | { status: 'pending'; request: FriendshipRequest }
  | { status: 'accepted' };

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

    async getUsers(): Promise<BackendUser[]> {
      const response = await http(joinUrl(baseUrl, '/api/users'));
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as BackendUser[];
    },

    async postUser(body: RegisterUserRequest): Promise<{ keyId: string }> {
      const response = await http(joinUrl(baseUrl, '/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { keyId: string };
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

    async getComments(messageId: string): Promise<StoredComment[]> {
      const url = new URL(joinUrl(baseUrl, '/api/comments'));
      url.searchParams.set('messageId', messageId);
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

    async postFriendshipRequest(body: {
      requesterKeyId: string;
      targetKeyId: string;
    }): Promise<CreateFriendshipRequestResult> {
      const response = await http(
        joinUrl(baseUrl, '/api/friendships/request'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as CreateFriendshipRequestResult;
    },

    async getIncomingFriendshipRequests(
      targetKeyId: string,
    ): Promise<FriendshipRequest[]> {
      const url = new URL(
        joinUrl(baseUrl, '/api/friendships/requests/incoming'),
      );
      url.searchParams.set('targetKeyId', targetKeyId);
      const response = await http(url);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as FriendshipRequest[];
    },

    async getOutgoingFriendshipRequests(
      requesterKeyId: string,
    ): Promise<FriendshipRequest[]> {
      const url = new URL(
        joinUrl(baseUrl, '/api/friendships/requests/outgoing'),
      );
      url.searchParams.set('requesterKeyId', requesterKeyId);
      const response = await http(url);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as FriendshipRequest[];
    },

    async acceptFriendshipRequest(body: {
      requesterKeyId: string;
      targetKeyId: string;
    }): Promise<{ status: 'accepted' }> {
      const response = await http(
        joinUrl(baseUrl, '/api/friendships/requests/accept'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as { status: 'accepted' };
    },

    async rejectFriendshipRequest(body: {
      requesterKeyId: string;
      targetKeyId: string;
    }): Promise<FriendshipRequest> {
      const response = await http(
        joinUrl(baseUrl, '/api/friendships/requests/reject'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as FriendshipRequest;
    },

    async getFriendships(ownerKeyId: string): Promise<Friendship[]> {
      const url = new URL(joinUrl(baseUrl, '/api/friendships'));
      url.searchParams.set('ownerKeyId', ownerKeyId);
      const response = await http(url);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as Friendship[];
    },

    async deleteFriendship(body: {
      ownerKeyId: string;
      friendKeyId: string;
    }): Promise<void> {
      const response = await http(joinUrl(baseUrl, '/api/friendships'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
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
            item.type === 'share' ? (item.messageId ?? item.id) : item.id,
          ),
        ),
      ];
      const commentsByMessageId: Record<string, StoredComment[]> = {};
      await Promise.all(
        threadIds.map(async (messageId) => {
          commentsByMessageId[messageId] = await this.getComments(messageId);
        }),
      );
      return { inbox, commentsByMessageId };
    },
  };
}

export type FeedApi = ReturnType<typeof createFeedApi>;

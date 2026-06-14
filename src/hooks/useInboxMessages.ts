import { useCallback, useEffect, useState } from 'react';
import { useKeysContext } from '@/hooks/useKeysContext.ts';
import { ecPublicJwkThumbprintSha256 } from '@/crypto/jwkThumbprint.ts';
import {
  listStoredMessagesForRecipientKeyId,
  type StoredMessage,
} from '@/services/db/storedMessages.ts';
import { hasMessageKeyManifestShard } from '@/services/db/storedMessageKeyManifest.ts';

export type InboxMessage = StoredMessage;

function ecPublicJwkIdentity(
  jwk: JsonWebKey | null | undefined,
): string | null {
  if (!jwk?.kty || !jwk.crv || !jwk.x || !jwk.y) {
    return null;
  }
  return `${jwk.kty}\0${jwk.crv}\0${jwk.x}\0${jwk.y}`;
}

export function useInboxMessages() {
  const keys = useKeysContext();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipientKeyId, setRecipientKeyId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [prevPublicKeyJwkIdentity, setPrevPublicKeyJwkIdentity] = useState<
    string | null
  >(null);
  const [prevRecipientKeyId, setPrevRecipientKeyId] = useState<
    string | null | undefined
  >(undefined);

  const publicKeyJwkIdentity = ecPublicJwkIdentity(keys?.publicKeyJwk);

  if (publicKeyJwkIdentity !== prevPublicKeyJwkIdentity) {
    setPrevPublicKeyJwkIdentity(publicKeyJwkIdentity);
    if (!publicKeyJwkIdentity) {
      setRecipientKeyId(null);
    }
  }

  useEffect(() => {
    const jwk = keys?.publicKeyJwk;
    if (!publicKeyJwkIdentity || !jwk) {
      return;
    }

    let cancelled = false;
    void ecPublicJwkThumbprintSha256(jwk).then((id) => {
      if (!cancelled) {
        setRecipientKeyId(id);
      }
    });

    return () => {
      cancelled = true;
    };
    // Intentionally omit keys?.publicKeyJwk: object identity can change each render while kty/crv/x/y do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publicKeyJwkIdentity is the stable semantic dependency
  }, [publicKeyJwkIdentity]);

  if (recipientKeyId !== prevRecipientKeyId) {
    setPrevRecipientKeyId(recipientKeyId);
    if (!recipientKeyId) {
      setMessages([]);
      setLoading(false);
      setHasLoadedOnce(false);
    } else {
      setError(null);
      if (!hasLoadedOnce) {
        setLoading(true);
      }
    }
  }

  useEffect(() => {
    if (!recipientKeyId) {
      return;
    }

    const keyId = recipientKeyId;
    let cancelled = false;

    async function loadInboxFromStore() {
      try {
        const storedMessages = await listStoredMessagesForRecipientKeyId(keyId);
        if (cancelled) {
          return;
        }
        setMessages(storedMessages);
        setHasLoadedOnce(true);
      } catch (e) {
        if (cancelled) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Failed to load messages.');
        setMessages([]);
        setHasLoadedOnce(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInboxFromStore();

    return () => {
      cancelled = true;
    };
  }, [recipientKeyId]);

  const loadInbox = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!recipientKeyId) {
        setMessages([]);
        setLoading(false);
        setHasLoadedOnce(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const storedMessages =
          await listStoredMessagesForRecipientKeyId(recipientKeyId);
        setMessages(storedMessages);
        setHasLoadedOnce(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load messages.');
        setMessages([]);
        setHasLoadedOnce(false);
      } finally {
        setLoading(false);
      }
    },
    [recipientKeyId],
  );

  const prependMessage = useCallback(
    async (message: StoredMessage) => {
      if (!recipientKeyId) {
        return;
      }

      if (!(await hasMessageKeyManifestShard(message.id, recipientKeyId))) {
        return;
      }

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === message.id)) {
          return prev;
        }
        return [message, ...prev];
      });
    },
    [recipientKeyId],
  );

  return {
    messages,
    loading: loading || Boolean(keys?.loading),
    error,
    reload: loadInbox,
    prependMessage,
    recipientKeyId,
  };
}

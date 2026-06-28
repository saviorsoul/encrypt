import React, {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createMockExternalRecipient,
  type MockExternalRecipientMaterial,
} from '@/crypto/mockExternalRecipient.ts';

/** Number of distinct mock peers generated for manifest encryption stress tests. */
export const MOCK_EXTERNAL_RECIPIENT_COUNT = 2000;

export type MockExternalRecipientContextValue = {
  loading: boolean;
  recipients: MockExternalRecipientMaterial[];
};

export const MockExternalRecipientContext =
  createContext<MockExternalRecipientContextValue | null>(null);

/** One batch of mock peers per browser session (survives provider remount on route changes). */
let sessionRecipients: MockExternalRecipientMaterial[] | null = null;
let sessionLoadPromise: Promise<MockExternalRecipientMaterial[]> | null = null;

async function loadMockExternalRecipientsOnce(): Promise<
  MockExternalRecipientMaterial[]
> {
  if (sessionRecipients) {
    return sessionRecipients;
  }
  if (!sessionLoadPromise) {
    sessionLoadPromise = Promise.all(
      Array.from({ length: MOCK_EXTERNAL_RECIPIENT_COUNT }, () =>
        createMockExternalRecipient(),
      ),
    )
      .then((next) => {
        sessionRecipients = next;
        return next;
      })
      .catch(() => {
        sessionLoadPromise = null;
        sessionRecipients = [];
        return [];
      });
  }
  return sessionLoadPromise;
}

export function MockExternalRecipientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [materials, setMaterials] = useState<MockExternalRecipientMaterial[]>(
    () => sessionRecipients ?? [],
  );
  const [loading, setLoading] = useState(() => sessionRecipients === null);

  useEffect(() => {
    if (sessionRecipients) {
      return;
    }

    let cancelled = false;

    loadMockExternalRecipientsOnce()
      .then((next) => {
        if (!cancelled) {
          setMaterials(next);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recipients = useMemo(() => materials, [materials]);
  const value: MockExternalRecipientContextValue = {
    loading,
    recipients,
  };

  return (
    <MockExternalRecipientContext value={value}>
      {children}
    </MockExternalRecipientContext>
  );
}

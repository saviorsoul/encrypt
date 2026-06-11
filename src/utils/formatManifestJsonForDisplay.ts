export type PayloadWithKeyManifest = {
  keyManifest?: Record<string, unknown>;
};

/** Returns a shallow copy whose keyManifest contains only the first entry. */
export function collapseKeyManifestForDisplay<T extends PayloadWithKeyManifest>(
  payload: T,
): T {
  const keyManifest = payload.keyManifest;
  if (keyManifest == null || typeof keyManifest !== 'object') {
    return payload;
  }

  const first = Object.entries(keyManifest)[0];
  if (!first) {
    return payload;
  }

  const [firstKey, firstEntry] = first;
  return {
    ...payload,
    keyManifest: {
      [firstKey]: firstEntry,
      '...': '... more recipient entries hidden from display',
    },
  };
}

/** Pretty-printed JSON for step output fields; keyManifest is collapsed for performance. */
export function stringifyManifestPayloadForDisplay(
  payload: unknown,
  indent = 2,
): string {
  if (payload == null || typeof payload !== 'object') {
    return JSON.stringify(payload, null, indent);
  }
  return JSON.stringify(
    collapseKeyManifestForDisplay(payload as PayloadWithKeyManifest),
    null,
    indent,
  );
}

import { parseImportPayloadText } from '@/utils/parseImportPayloadText.ts';
import { parseManifestPayloadText } from '@/utils/parseManifestPayloadText.ts';

export type ImportDestination = 'oneToOne' | 'feed';

function destinationFromKeyManifestCount(
  recipientCount: number,
): ImportDestination | null {
  if (recipientCount === 2) {
    return 'oneToOne';
  }
  if (recipientCount > 2) {
    return 'feed';
  }
  return null;
}

export function getImportDestinationFromText(
  text: string,
): ImportDestination | null {
  const parsed = parseImportPayloadText(text);
  if (parsed.ok) {
    if (parsed.payload.kind === 'share') {
      return 'feed';
    }

    return destinationFromKeyManifestCount(
      Object.keys(parsed.payload.keyManifest).length,
    );
  }

  const manifest = parseManifestPayloadText(text);
  if (manifest.ok) {
    return destinationFromKeyManifestCount(
      Object.keys(manifest.payload.keyManifest ?? {}).length,
    );
  }

  return null;
}

export function getImportDestinationRoute(
  destination: ImportDestination,
): '/' | '/feed' {
  return destination === 'oneToOne' ? '/' : '/feed';
}

export function isOnImportDestinationRoute(
  pathname: string,
  destination: ImportDestination,
): boolean {
  if (destination === 'oneToOne') {
    return pathname === '/' || pathname === '/1-1';
  }

  return pathname === '/feed' || pathname.startsWith('/feed/');
}

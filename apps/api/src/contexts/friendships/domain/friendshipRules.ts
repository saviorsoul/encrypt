import { badRequest } from '@/lib/httpError.js';

export function assertDistinctKeyIds(keyIdA: string, keyIdB: string): void {
  if (keyIdA === keyIdB) {
    throw badRequest('Cannot create a friendship with yourself.');
  }
}

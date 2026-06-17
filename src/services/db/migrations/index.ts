import type { DbMigration, DbMigrationContext } from './types.ts';

/**
 * IndexedDB data migrations, keyed by the version they upgrade *to*.
 *
 * When changing stored record shapes:
 * 1. Add `v{N}YourMigration.ts` with a `DbMigration` (use `rewriteObjectStore` for in-place edits).
 * 2. Register it in `DB_MIGRATIONS` below (keep sorted by version).
 * 3. Bump `DB_VERSION` in `cryptoDb.ts`.
 *
 * Schema changes (new stores/indexes) stay in `openCryptoDb`'s `onupgradeneeded` handler.
 * Data transforms belong here so existing rows survive app updates.
 */
export const DB_MIGRATIONS: readonly DbMigration[] = [
  // vXTestMigration,
];

export function runDbMigrations(ctx: DbMigrationContext): void {
  const { oldVersion, newVersion } = ctx;

  for (const migration of DB_MIGRATIONS) {
    if (migration.version <= oldVersion || migration.version > newVersion) {
      continue;
    }
    migration.upgrade(ctx);
  }
}

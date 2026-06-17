export type DbMigrationContext = {
  db: IDBDatabase;
  tx: IDBTransaction;
  oldVersion: number;
  newVersion: number;
};

export type DbMigration = {
  /** Database version this migration upgrades *to* (must be unique). */
  version: number;
  /** Short label for debugging. */
  name: string;
  upgrade: (ctx: DbMigrationContext) => void;
};

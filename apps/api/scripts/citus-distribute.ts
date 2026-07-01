import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import '../src/loadEnv.js';
import { readConfig } from '../src/config.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(scriptDir, '../prisma/citus/distribute.sql');

async function main(): Promise<void> {
  const { databaseUrl } = readConfig();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const sql = readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Citus distribution applied.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

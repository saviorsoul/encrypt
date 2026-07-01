import { spawnSync } from 'node:child_process';
import '../src/loadEnv.js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: run-with-env.ts <command> [args...]');
  process.exit(1);
}

const [command, ...commandArgs] = args;
const result = spawnSync(command, commandArgs, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);

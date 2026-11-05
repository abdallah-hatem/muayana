import { config } from 'dotenv';
import { resolve } from 'node:path';

// e2e reads its settings from the environment; apps/api/.env.test fills in anything unset
// (copy .env.test.example). Nothing here hardcodes a port or a connection string, so a
// parallel agent points the suite at its own database and port block (README → Tests):
//   DATABASE_URL=<from npm run db:agent -- create <name>> API_PORT=31N1 npm run test:e2e
// API_PORT is accepted as an alias for PORT; an explicit PORT wins.
if (!process.env.PORT && process.env.API_PORT)
  process.env.PORT = process.env.API_PORT;
config({ path: resolve(__dirname, '..', '.env.test'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error('e2e needs DATABASE_URL (see apps/api/.env.test.example)');
if (!process.env.PORT)
  throw new Error(
    'e2e needs PORT or API_PORT (see apps/api/.env.test.example)',
  );

// Teardown deletes rows: refuse the development database and the agent template. Allowed:
// muayana_test, or an agent database muayana_<name> made by scripts/db-agent.mjs.
const database = new URL(url).pathname.replace(/^\//, '');
const FORBIDDEN = new Set(['muayana', 'muayana_template', 'postgres']);
if (FORBIDDEN.has(database) || !database.startsWith('muayana_')) {
  throw new Error(
    `e2e refuses to run against "${database}": use muayana_test or an agent database (muayana_<name>)`,
  );
}

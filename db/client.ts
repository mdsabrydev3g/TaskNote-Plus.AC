import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let cached: Database | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Lazily creates the Drizzle client. Nothing here runs during `next build`,
 * which is why the production build needs no database connection.
 */
export function db(): Database {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_MISSING: set DATABASE_URL in your environment (.env.local or Vercel).');
  }

  // Neon's HTTP driver is the right fit on Vercel serverless; any other
  // Postgres (local dev, self-hosted) goes through node-postgres.
  if (url.includes('neon.tech')) {
    cached = drizzleNeon(neon(url), { schema }) as unknown as Database;
  } else {
    const pool = new Pool({ connectionString: url, max: 5 });
    cached = drizzleNode(pool, { schema });
  }

  return cached;
}

export { schema };

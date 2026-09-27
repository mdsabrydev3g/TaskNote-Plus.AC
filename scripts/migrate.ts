/**
 * Applies generated Drizzle migrations to the target database.
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const client = drizzle(pool);

  console.log('Applying migrations from ./db/migrations …');
  await migrate(client, { migrationsFolder: './db/migrations' });
  await pool.end();
  console.log('Migrations applied.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

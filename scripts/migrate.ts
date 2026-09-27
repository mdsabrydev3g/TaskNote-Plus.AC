/**
 * Applies generated Drizzle migrations to the target database.
 * Usage: npm run db:migrate
 *
 * Env resolution order: .env.local -> .env -> already-exported variables.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

loadEnvFiles();

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required. Add it to .env.local or export it.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const client = drizzle(pool);

  console.log('Applying migrations from ./db/migrations …');
  await migrate(client, { migrationsFolder: './db/migrations' });
  await pool.end();
  console.log('Migrations applied.');
}

function loadEnvFiles(): void {
  // Node's built-in loader: no dotenv dependency needed.
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file is expected in CI and on Vercel.
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

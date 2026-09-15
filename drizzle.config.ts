import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are generated locally, committed under drizzle/, and applied by
 * .github/workflows/migrate.yml on merge — never at app boot, where concurrent
 * serverless instances would race each other.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true
});

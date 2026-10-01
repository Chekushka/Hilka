/**
 * Applies drizzle/ to a Vercel preview's own database during its build
 * (lib/db/preview-migration.ts says when, and why only previews). A no-op
 * everywhere else, so `npm run build` stays the one build command.
 *
 * Same migrator and bookkeeping table as `npm run db:migrate`, so a preview
 * branch copied from production applies only what production has not got
 * yet. One connection holding an advisory lock: two builds of the same
 * preview started close together take turns instead of both applying the
 * same migration.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { describeDatabase, previewMigrationPlan } from '@/lib/db/preview-migration';

// Arbitrary, fixed: every preview build of this app contends for the same lock key.
const LOCK_KEY = 4_802_331;

async function main() {
  const plan = previewMigrationPlan(process.env);
  if (plan.action === 'skip') {
    console.log(`[migrate-preview] skipped: ${plan.reason}`);
    return;
  }
  if (plan.action === 'fail') {
    throw new Error(plan.reason);
  }

  console.log(`[migrate-preview] migrating ${describeDatabase(plan.url)}`);
  if (plan.pooled) {
    console.warn('[migrate-preview] DATABASE_URL_UNPOOLED is not set; migrating through the pooled string');
  }
  const client = new Client({ connectionString: plan.url });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
    console.log('[migrate-preview] migrations applied');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(`[migrate-preview] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

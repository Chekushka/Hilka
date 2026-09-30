/**
 * Whether this build migrates its database, and which connection string it
 * uses (docs/CI_CD.md, step 6). Pure: reads only the environment it is given.
 *
 * Only a Vercel **preview** build migrates. Each preview gets its own Neon
 * branch, copied from production when the preview is created, and nothing
 * else ever migrates it — so without this, a PR that adds a migration
 * deploys a preview whose queries fail on the missing column. A build runs
 * once per deployment, so this is not the race that migrating at app boot
 * would be. Production keeps migrating through .github/workflows/migrate.yml
 * on merge, never from a build.
 */

export type PreviewMigrationPlan =
  | { action: 'skip'; reason: string }
  | { action: 'migrate'; url: string; pooled: boolean }
  | { action: 'fail'; reason: string };

export function previewMigrationPlan(env: Record<string, string | undefined>): PreviewMigrationPlan {
  if (env.VERCEL_ENV !== 'preview') {
    return { action: 'skip', reason: `not a Vercel preview build (VERCEL_ENV=${env.VERCEL_ENV ?? 'unset'})` };
  }
  // DDL through Neon's transaction pooler misbehaves: the unpooled string first.
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return { action: 'migrate', url: unpooled, pooled: false };
  const pooled = env.DATABASE_URL?.trim();
  if (pooled) return { action: 'migrate', url: pooled, pooled: true };
  return {
    action: 'fail',
    reason:
      'this preview has no DATABASE_URL — is the Neon integration creating a branch per preview deployment? (docs/CI_CD.md, step 6)'
  };
}

/** Where a build is migrating, for the log: host and database, never the password. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

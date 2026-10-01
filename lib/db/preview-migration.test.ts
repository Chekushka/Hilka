import { describe, expect, it } from 'vitest';
import { describeDatabase, previewMigrationPlan } from './preview-migration';

const UNPOOLED = 'postgresql://user:secret@ep-preview-123.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const POOLED = 'postgresql://user:secret@ep-preview-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

describe('previewMigrationPlan', () => {
  it('never migrates production, development, CI or a local build', () => {
    for (const env of [
      { VERCEL_ENV: 'production', DATABASE_URL_UNPOOLED: UNPOOLED },
      { VERCEL_ENV: 'development', DATABASE_URL: POOLED },
      { DATABASE_URL: POOLED },
      {}
    ]) {
      expect(previewMigrationPlan(env).action).toBe('skip');
    }
  });

  it('migrates a preview through the unpooled string when there is one', () => {
    expect(previewMigrationPlan({ VERCEL_ENV: 'preview', DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: UNPOOLED })).toEqual({
      action: 'migrate',
      url: UNPOOLED,
      pooled: false
    });
  });

  it('falls back to the pooled string, and says so', () => {
    expect(previewMigrationPlan({ VERCEL_ENV: 'preview', DATABASE_URL: POOLED })).toEqual({
      action: 'migrate',
      url: POOLED,
      pooled: true
    });
  });

  it('fails a preview with no database rather than deploy one that crashes', () => {
    expect(previewMigrationPlan({ VERCEL_ENV: 'preview', DATABASE_URL: ' ' }).action).toBe('fail');
  });
});

describe('describeDatabase', () => {
  it('names the host and database, never the password', () => {
    const text = describeDatabase(UNPOOLED);
    expect(text).toBe('ep-preview-123.eu-central-1.aws.neon.tech/neondb');
    expect(text).not.toContain('secret');
  });

  it('does not echo an unparseable string', () => {
    expect(describeDatabase('not a url with secret')).not.toContain('secret');
  });
});

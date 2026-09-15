/**
 * The database connection. Route handlers and server components only — nothing
 * in components/, lib/runner/ or lib/checker/ may import this (CLAUDE.md rule
 * 4), and scripts/guardrails.sh enforces it.
 *
 * Driver: node-postgres over Neon's pooled connection string. It is also what
 * a plain local Postgres speaks, so tests and CI run against a real database
 * without a Neon account. If the per-request connect cost turns out to matter
 * once it is measured on Vercel (docs/TASKS.md), this file is the single place
 * that swaps to @neondatabase/serverless — queries and schema stay unchanged.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

let cached: Database | null = null;

export function getDb(): Database {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is not set. See docs/CI_CD.md — a local Postgres or a Neon dev branch.'
      );
    }
    // One small pool per serverless instance; instances are short-lived and
    // the class is ~25 students, so a large pool buys nothing.
    cached = drizzle(new Pool({ connectionString: url, max: 5 }), { schema });
  }
  return cached;
}

/**
 * Topic lookups for the authoring flow. `topics.slug` is the stable content
 * key (docs/AI_CONTEXT.md) — an author names a topic the same way
 * content/seed-tasks/ does, and the route handler resolves it to the uuid
 * the `tasks` foreign key actually needs.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { topics } from './schema';

export async function getTopicIdBySlug(slug: string): Promise<string | null> {
  const [row] = await getDb().select({ id: topics.id }).from(topics).where(eq(topics.slug, slug)).limit(1);
  return row?.id ?? null;
}

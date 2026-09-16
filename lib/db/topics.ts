/**
 * Topic lookups for the authoring flow. `topics.slug` is the stable content
 * key (docs/AI_CONTEXT.md) — an author names a topic the same way
 * content/seed-tasks/ does, and the route handler resolves it to the uuid
 * the `tasks` foreign key actually needs.
 */
import { asc, eq } from 'drizzle-orm';
import { getDb } from './client';
import { topics } from './schema';

export async function getTopicIdBySlug(slug: string): Promise<string | null> {
  const [row] = await getDb().select({ id: topics.id }).from(topics).where(eq(topics.slug, slug)).limit(1);
  return row?.id ?? null;
}

export interface TopicOption {
  slug: string;
  title: string;
  gradeTags: number[];
}

/**
 * For the authoring form's topic picker — curriculum order, not alphabetical.
 * Keyed by slug, not id: POST /api/tasks takes `topicSlug` (the stable
 * content key), so the form never needs to know a topic's uuid at all.
 */
export async function listTopics(): Promise<TopicOption[]> {
  return getDb()
    .select({ slug: topics.slug, title: topics.title, gradeTags: topics.gradeTags })
    .from(topics)
    .orderBy(asc(topics.order));
}

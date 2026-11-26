import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PresentDeck } from '@/components/lesson/PresentDeck';
import { getLessonTheory } from '@/lib/db/lessons';

export const dynamic = 'force-dynamic';

/**
 * A lesson's theory on the projector (components/lesson/PresentDeck.tsx).
 * Open like the lesson page itself (/practice/[lesson]): it shows nothing
 * a student cannot read there, and the board's computer need not be logged
 * in. Opened from the teacher's lesson list, lesson page and session page.
 */
export async function generateMetadata({ params }: { params: Promise<{ lesson: string }> }): Promise<Metadata> {
  const lesson = await getLessonTheory((await params).lesson);
  return { title: lesson ? `${lesson.title} · Hilka` : 'Hilka' };
}

export default async function PresentPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: slug } = await params;
  const lesson = await getLessonTheory(slug);
  if (!lesson) notFound();
  return <PresentDeck title={lesson.title} markdown={lesson.explanationMd} />;
}

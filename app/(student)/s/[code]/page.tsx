import { notFound } from 'next/navigation';
import { SessionRunner } from '@/components/session/SessionRunner';
import { findOpenSessionByCode } from '@/lib/db/sessions';

/**
 * Session join + task runner, at the URL a teacher reads out loud.
 * Server component: it is the only thing here allowed to touch the database
 * (CLAUDE.md rule 4). Re-fetched on every load, so a session that closes
 * mid-lesson stops admitting new joins without a deploy.
 */
export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await findOpenSessionByCode(code);
  if (!session) {
    notFound();
  }
  return <SessionRunner session={session} />;
}

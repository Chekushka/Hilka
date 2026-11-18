import { notFound } from 'next/navigation';
import { SessionRoom } from '@/components/session/SessionRoom';
import { getOpenSessionByCode } from '@/lib/db/sessions';

/**
 * Join-by-code entry point. A server component reads the session directly
 * (CLAUDE.md rule 4) and hands a plain object to the client room; a closed or
 * unknown code is indistinguishable to the student and lands on the same calm
 * not-found screen a teacher's mistyped code deserves.
 */
export const dynamic = 'force-dynamic';

export default async function SessionPage({
  params,
  searchParams
}: {
  params: Promise<{ code: string }>;
  /** `task`: a task's id — the teacher's link to one task opens it once a name is picked. */
  searchParams: Promise<{ task?: string }>;
}) {
  const { code } = await params;
  const { task } = await searchParams;
  const session = await getOpenSessionByCode(code);
  if (!session) {
    notFound();
  }
  return <SessionRoom code={code.toUpperCase()} session={session} initialTaskId={typeof task === 'string' ? task : null} />;
}

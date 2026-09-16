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
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getOpenSessionByCode(code);
  if (!session) {
    notFound();
  }
  return <SessionRoom code={code.toUpperCase()} session={session} />;
}

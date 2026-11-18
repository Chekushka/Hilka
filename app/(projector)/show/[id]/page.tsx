import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { FullscreenButton } from '@/components/game/FullscreenButton';
import { RaceTrack } from '@/components/game/RaceTrack';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { listAttemptsForSession } from '@/lib/db/attempts';
import { getSessionForTeacher } from '@/lib/db/sessions';
import {
  boardOf,
  FIRST_TRY_BONUS,
  POINTS_PER_DIFFICULTY,
  possiblePoints,
  PROJECTOR_TOP,
  raceStandings
} from '@/lib/game/race';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * What the teacher puts on the projector (docs/design-brief-python-platform.md,
 * "Entry": the code must be readable from the back of the room): the session
 * code as large as the screen allows, one tile per character so 0/O and 1/I
 * cannot blur, the address to type it at and the direct link. With the class
 * race on (lib/game/race.ts), the board below, refreshed every few seconds.
 * The teacher's own: owner-scoped like the session page.
 */
export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect('/login');
  const { id } = await params;
  const session = await getSessionForTeacher(id, teacher.id);
  if (!session) notFound();

  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? '';
  const board = session.game
    ? boardOf(raceStandings(session.roster, session.tasks, await listAttemptsForSession(session.id)), PROJECTOR_TOP)
    : null;

  return (
    <main className="flex flex-1 flex-col gap-8 px-8 py-6">
      {session.open && <AutoRefresh everyMs={5000} />}
      <div className="flex items-center justify-between gap-4 text-lg text-ink-muted">
        <span>{session.classTitle}</span>
        <FullscreenButton />
      </div>

      {session.open ? (
        <section aria-labelledby="show-code" className={`flex flex-col items-center gap-6 text-center ${board ? '' : 'flex-1 justify-center'}`}>
          <h1 id="show-code" className="text-3xl font-semibold text-ink">
            {t('show.joinTitle')}
          </h1>
          <p className="text-2xl text-ink">
            {t('show.joinAt')} <span className="font-bold text-accent">{host}</span>
          </p>
          <p className="flex gap-[1.5vw]" aria-label={t('show.codeLabel', { code: session.code.split('').join(' ') })} data-testid="show-code">
            {session.code.split('').map((char, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`flex items-center justify-center rounded-2xl border-4 border-accent bg-code-bg font-mono font-bold text-ink ${
                  board ? 'h-[13vw] w-[10vw] text-[9vw] max-h-48 max-w-36' : 'h-[18vw] w-[13vw] text-[12vw]'
                }`}
              >
                {char}
              </span>
            ))}
          </p>
          <p className="text-xl text-ink-muted">
            {t('show.orLink')} <span className="font-semibold text-ink">{`${host}/s/${session.code}`}</span>
          </p>
        </section>
      ) : (
        <p className="flex flex-1 items-center justify-center text-3xl text-ink-muted">{t('show.closed')}</p>
      )}

      {board && (
        <section aria-labelledby="show-race" className="mx-auto w-full max-w-6xl rounded-2xl border-2 border-line bg-surface p-6" data-testid="show-race">
          <h2 id="show-race" className="mb-1 text-3xl font-bold text-ink">
            🏁 {t('race.title')}
          </h2>
          <p className="mb-5 text-lg text-ink-muted">
            {t('race.rules', { per: POINTS_PER_DIFFICULTY, bonus: FIRST_TRY_BONUS })}
          </p>
          <RaceTrack large lanes={board.map(({ name, points, place }) => ({ name, points, place }))} possible={possiblePoints(session.tasks, session.assignment.poolSize)} />
        </section>
      )}
    </main>
  );
}

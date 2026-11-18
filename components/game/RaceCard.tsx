'use client';

/**
 * The class race in the student's room (lib/game/race.ts): their own points,
 * how many more reach the next place up, and the top names. Shown on the task
 * list, between tasks — never inside the workspace, which stays a calm tool
 * (docs/design-brief-python-platform.md). A student is never told they are
 * near the bottom: below the board they see only their points and the gap to
 * the next place, which every solved task closes.
 */
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { FIRST_TRY_BONUS, POINTS_PER_DIFFICULTY } from '@/lib/game/race';
import type { RaceBoard } from '@/lib/game/types';
import { RaceTrack } from './RaceTrack';

const POLL_MS = 10_000;

export function RaceCard({ code, studentId, refreshKey }: { code: string; studentId: string; refreshKey: number }) {
  const [board, setBoard] = useState<RaceBoard | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/sessions/${code}/race?student=${encodeURIComponent(studentId)}`)
        .then((response) => (response.ok ? (response.json() as Promise<RaceBoard>) : Promise.reject()))
        .then((next) => {
          if (!cancelled) setBoard(next);
        })
        // The race is a bonus: without it the room works exactly as before.
        .catch(() => undefined);
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code, studentId, refreshKey]);

  if (!board) return null;
  const me = board.me;
  return (
    <section aria-labelledby="race-title" className="rounded-xl border-2 border-honey bg-surface p-4" data-testid="race-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="race-title" className="text-lg font-bold text-ink">
          🏁 {t('race.title')}
        </h2>
        {me && (
          <span className="rounded-full bg-honey-soft px-3 py-1 text-sm font-bold text-honey-ink" data-testid="race-my-points">
            {t('race.myPoints', { n: me.points })}
          </span>
        )}
      </div>
      {me && (
        <p className="mt-1 text-sm text-ink" data-testid="race-my-line">
          {me.toNextPlace === null
            ? me.points > 0
              ? t('race.leading')
              : t('race.start')
            : me.onBoard
              ? t('race.onBoard', { place: me.place, n: me.toNextPlace })
              : t('race.toNext', { n: me.toNextPlace })}
        </p>
      )}
      <div className="mt-3">
        <RaceTrack lanes={board.top} possible={board.possible} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t('race.rules', { per: POINTS_PER_DIFFICULTY, bonus: FIRST_TRY_BONUS })}</p>
    </section>
  );
}

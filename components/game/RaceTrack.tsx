/**
 * The class race drawn as lanes (lib/game/race.ts): one lane per name on the
 * board, a runner as far along as their points reach toward the finish. Place
 * and points are written out — the position is never the only cue — and the
 * runner moves once per update, with no continuous animation
 * (docs/design-brief-python-platform.md, hard constraints).
 */
import { t } from '@/lib/i18n';

export interface RaceLane {
  name: string;
  points: number;
  place: number;
  me?: boolean;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export function RaceTrack({ lanes, possible, large = false }: { lanes: RaceLane[]; possible: number; large?: boolean }) {
  if (lanes.length === 0) {
    return <p className={`${large ? 'text-2xl' : 'text-sm'} text-ink-muted`}>{t('race.empty')}</p>;
  }
  return (
    <ol className={large ? 'space-y-3' : 'space-y-2'} data-testid="race-track">
      {lanes.map((lane) => {
        const share = possible > 0 ? Math.min(1, lane.points / possible) : 0;
        return (
          <li
            key={`${lane.place}-${lane.name}`}
            className={`grid items-center gap-3 ${large ? 'grid-cols-[4rem_14rem_1fr_6rem] text-2xl' : 'grid-cols-[2rem_7rem_1fr_3.5rem] text-sm'}`}
            data-me={lane.me ? 'true' : undefined}
          >
            <span className="text-center font-bold tabular-nums text-ink">
              {lane.place <= 3 ? <span aria-label={t('race.place', { n: lane.place })}>{MEDAL[lane.place - 1]}</span> : t('race.placeShort', { n: lane.place })}
            </span>
            <span className={`truncate font-semibold ${lane.me ? 'text-accent' : 'text-ink'}`}>
              {lane.name}
              {lane.me && <span className="ml-1 text-xs font-normal text-ink-muted">{t('race.you')}</span>}
            </span>
            <span
              className={`relative block rounded-full border-2 border-dashed border-line bg-shell ${large ? 'h-10' : 'h-6'}`}
              aria-hidden="true"
            >
              <span
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 motion-reduce:transition-none ${lane.me ? 'bg-accent/40' : 'bg-growth/40'}`}
                style={{ width: `${share * 100}%` }}
              />
              <span
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 motion-reduce:transition-none ${large ? 'text-3xl' : 'text-lg'}`}
                style={{ left: `clamp(0.75rem, ${share * 100}%, calc(100% - 0.75rem))` }}
              >
                🚀
              </span>
              <span className={`absolute right-1 top-1/2 -translate-y-1/2 ${large ? 'text-2xl' : 'text-sm'}`}>🏁</span>
            </span>
            <span className="text-right font-bold tabular-nums text-honey-ink">{t('race.points', { n: lane.points })}</span>
          </li>
        );
      })}
    </ol>
  );
}

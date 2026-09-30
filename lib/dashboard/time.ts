/**
 * Times on the teacher's screens. Pure; the words come from messages/uk.json
 * through the caller. A server component renders these, so the clock is
 * pinned to the school's time zone rather than the server's (UTC on Vercel).
 */

export const SCHOOL_TIME_ZONE = 'Europe/Kyiv';

const clock = new Intl.DateTimeFormat('uk-UA', {
  timeZone: SCHOOL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** "14:07" in Kyiv time. */
export function formatClock(iso: string): string {
  return clock.format(new Date(iso));
}

/** "6:12", or "1:02:05" past an hour. Rounds down to whole seconds. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export type Ago = { unit: 'now' } | { unit: 'minutes'; n: number } | { unit: 'hours'; n: number };

/** How long ago, in the coarse steps a glance needs: under a minute is "now". */
export function agoFrom(iso: string, now: number): Ago {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return { unit: 'now' };
  if (minutes < 60) return { unit: 'minutes', n: minutes };
  return { unit: 'hours', n: Math.floor(minutes / 60) };
}

const date = new Intl.DateTimeFormat('uk-UA', { timeZone: SCHOOL_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });

/** "30.09.2026" in Kyiv time. */
export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

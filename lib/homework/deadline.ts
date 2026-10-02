/**
 * The deadline in words, for the student's room and the teacher's screens:
 * "пт, 10 жовтня, 18:00" in Kyiv time, and how far off it is ("через 2 дні"),
 * never a ticking clock — a countdown is pressure the design brief avoids.
 * Pure; Intl does the Ukrainian plurals. Always a number of days ("через 1
 * день"), never "завтра": 30 hours is not always tomorrow.
 */
import { SCHOOL_TIME_ZONE } from '@/lib/dashboard/time';

const full = new Intl.DateTimeFormat('uk-UA', {
  timeZone: SCHOOL_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const relative = new Intl.RelativeTimeFormat('uk', { numeric: 'always' });

/** "пт, 10 жовтня о 18:00" or similar, as Intl writes it for Ukrainian. */
export function formatDeadline(iso: string): string {
  return full.format(new Date(iso));
}

const HOUR_MS = 60 * 60 * 1000;

/** "через 2 дні", "через 5 годин", "1 день тому". */
export function deadlineDistance(iso: string, nowMs: number): string {
  const diffMs = Date.parse(iso) - nowMs;
  const hours = diffMs / HOUR_MS;
  if (Math.abs(hours) >= 24) return relative.format(Math.trunc(hours / 24), 'day');
  if (Math.abs(hours) >= 1) return relative.format(Math.trunc(hours), 'hour');
  return relative.format(Math.trunc(diffMs / 60_000), 'minute');
}

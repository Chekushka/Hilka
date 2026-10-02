/**
 * Device marks (docs/HOMEWORK.md, section 2, option D): entry stays free —
 * pick a name from the roster — and every attempt records a random per-browser
 * id. Nothing is blocked; the teacher sees how many devices worked under a
 * name and can cancel what one of them did. Pure.
 */

export interface DeviceAttempt {
  deviceId: string | null;
  createdAt: string;
}

export interface DeviceSummary {
  deviceId: string;
  /** 1-based, in order of first use — «Пристрій 1» is whichever started. */
  number: number;
  attempts: number;
  firstAt: string;
  lastAt: string;
}

/** Distinct devices in order of first use. Attempts recorded before device marks existed are left out. */
export function summarizeDevices(attempts: readonly DeviceAttempt[]): DeviceSummary[] {
  const byDevice = new Map<string, { attempts: number; firstAt: string; lastAt: string }>();
  for (const attempt of attempts) {
    if (!attempt.deviceId) continue;
    const current = byDevice.get(attempt.deviceId);
    if (!current) {
      byDevice.set(attempt.deviceId, { attempts: 1, firstAt: attempt.createdAt, lastAt: attempt.createdAt });
    } else {
      current.attempts += 1;
      if (attempt.createdAt < current.firstAt) current.firstAt = attempt.createdAt;
      if (attempt.createdAt > current.lastAt) current.lastAt = attempt.createdAt;
    }
  }
  return [...byDevice.entries()]
    .sort(([, a], [, b]) => (a.firstAt < b.firstAt ? -1 : a.firstAt > b.firstAt ? 1 : 0))
    .map(([deviceId, summary], index) => ({ deviceId, number: index + 1, ...summary }));
}

/** Whether a name was used from some device other than `mine` — the student's calm notice. */
export function usedElsewhere(attempts: readonly DeviceAttempt[], mine: string | null): boolean {
  return attempts.some((attempt) => attempt.deviceId !== null && attempt.deviceId !== mine);
}

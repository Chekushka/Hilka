'use client';

/**
 * The browser side of the school-computer mark (lib/device/school.ts): read it
 * from `document.cookie`, set or clear it from the /school page. Marking a PC
 * also removes practice progress an earlier student left in localStorage —
 * from then on it lives in sessionStorage (lib/practice/local-progress.ts).
 */
import { useSyncExternalStore } from 'react';
import { clearAllLocalPractice } from '@/lib/practice/local-progress';
import { hasSchoolMark, SCHOOL_COOKIE_MAX_AGE_S, SCHOOL_COOKIE_NAME, SCHOOL_COOKIE_VALUE } from './school';

const listeners = new Set<() => void>();

export function isSchoolComputer(): boolean {
  try {
    return hasSchoolMark(document.cookie);
  } catch {
    return false;
  }
}

export function setSchoolComputer(on: boolean): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = on
    ? `${SCHOOL_COOKIE_NAME}=${SCHOOL_COOKIE_VALUE}; Max-Age=${SCHOOL_COOKIE_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`
    : `${SCHOOL_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  // Whatever a student left here belongs to them, not to the next one; either way the slate starts clean.
  clearAllLocalPractice();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** False on the server and on first render, then the browser's mark. */
export function useSchoolComputer(): boolean {
  return useSyncExternalStore(subscribe, isSchoolComputer, () => false);
}

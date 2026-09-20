'use client';

/**
 * Reads/writes practice progress from `localStorage` — the primary store
 * (docs/AI_CONTEXT.md, "Progress Codes"); a progress code is portability and
 * backup, not the mechanism itself. `useSyncExternalStore` needs a snapshot
 * function that returns the *same* reference when nothing changed, or React
 * warns about an uncached snapshot and re-renders forever — `readProgress`
 * caches against the raw string it last parsed rather than re-parsing (and
 * allocating a new object) on every read.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { EMPTY_PROGRESS, isValidPracticeProgress, type PracticeProgress } from './progress';

const PROGRESS_STORAGE_KEY = 'hilka:practice:progress';
const CODE_STORAGE_KEY = 'hilka:practice:code';

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: PracticeProgress = EMPTY_PROGRESS;

function readProgress(): PracticeProgress {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedValue = parsed && isValidPracticeProgress(parsed) ? parsed : EMPTY_PROGRESS;
  } catch {
    cachedValue = EMPTY_PROGRESS;
  }
  return cachedValue;
}

function writeProgress(progress: PracticeProgress) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or a full quota — the student keeps working for this
    // visit, just without a saved copy to come back to.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocalProgress() {
  const progress = useSyncExternalStore(subscribe, readProgress, () => EMPTY_PROGRESS);
  const setProgress = useCallback((updater: (previous: PracticeProgress) => PracticeProgress) => {
    writeProgress(updater(readProgress()));
  }, []);
  return [progress, setProgress] as const;
}

/**
 * The progress code this browser last minted or restored, cached so "save
 * progress" reuses the same code instead of minting a new one every visit —
 * the code stays legible when AI_CONTEXT.md's mitigation ("show the code
 * again on every save") shows it back to the student.
 */
export function loadLocalProgressCode(): string | null {
  try {
    return localStorage.getItem(CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLocalProgressCode(code: string): void {
  try {
    localStorage.setItem(CODE_STORAGE_KEY, code);
  } catch {
    // Same as writeProgress above — nothing to recover mid-session.
  }
}

const noSubscription = () => () => {};

/**
 * Read-once-on-mount, same pattern as `SessionRoom`'s `useStoredName`: the
 * server render and the first client render must agree (null, since the
 * server has no `localStorage`), so this does not subscribe to later writes
 * — the component updates its own state after a successful save instead.
 */
export function useLocalProgressCode(): string | null {
  return useSyncExternalStore(noSubscription, loadLocalProgressCode, () => null);
}

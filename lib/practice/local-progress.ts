'use client';

/**
 * Reads/writes practice progress from `localStorage` — the primary store
 * (docs/AI_CONTEXT.md, "Progress Codes"); a progress code is portability and
 * backup, not the mechanism itself. `useSyncExternalStore` needs a snapshot
 * function that returns the *same* reference when nothing changed, or React
 * warns about an uncached snapshot and re-renders forever — `readProgress`
 * caches against the raw string it last parsed rather than re-parsing (and
 * allocating a new object) on every read.
 *
 * On a school computer (lib/device/school.ts) nothing is left behind instead:
 * progress and its code live in `sessionStorage`, so they end with the
 * browser; they are dropped after `SCHOOL_IDLE_MS` with no key press or click,
 * so the next student never continues as the last; and every change is saved
 * to the progress code at once (minting one on the first), so dropping them
 * loses nothing the code cannot bring back (docs/AI_CONTEXT.md, "School
 * Computers").
 */
import { useCallback, useSyncExternalStore } from 'react';
import { hasSchoolMark, isIdleExpired } from '@/lib/device/school';
import { normalizeProgressCode } from './code';
import { EMPTY_PROGRESS, isValidPracticeProgress, type PracticeProgress } from './progress';

const PROGRESS_STORAGE_KEY = 'hilka:practice:progress';
const CODE_STORAGE_KEY = 'hilka:practice:code';
/** School computers only: when a student last pressed a key or clicked. */
const ACTIVE_STORAGE_KEY = 'hilka:practice:active';
/** A burst of changes (a pass, then the character) is one save. */
const SAVE_DELAY_MS = 800;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: PracticeProgress = EMPTY_PROGRESS;

function onSchoolComputer(): boolean {
  try {
    return hasSchoolMark(document.cookie);
  } catch {
    return false;
  }
}

/** Where practice lives on this browser; null when storage is unavailable (private mode, blocked). */
function store(): Storage | null {
  try {
    return onSchoolComputer() ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * On a school computer, drops the progress of a student who walked away.
 * Idempotent, so reads may call it; true when something was dropped.
 */
function dropIfIdle(): boolean {
  if (!onSchoolComputer()) return false;
  try {
    const raw = sessionStorage.getItem(ACTIVE_STORAGE_KEY);
    if (!isIdleExpired(raw === null ? null : Number(raw), Date.now())) return false;
    sessionStorage.removeItem(PROGRESS_STORAGE_KEY);
    sessionStorage.removeItem(CODE_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readProgress(): PracticeProgress {
  dropIfIdle();
  let raw: string | null;
  try {
    raw = store()?.getItem(PROGRESS_STORAGE_KEY) ?? null;
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
    store()?.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or a full quota — the student keeps working for this
    // visit, just without a saved copy to come back to.
  }
  if (onSchoolComputer()) {
    // The updater already read through `dropIfIdle`; this write is the student's own.
    touch();
    scheduleSave();
  }
  notify();
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
  dropIfIdle();
  try {
    return store()?.getItem(CODE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveLocalProgressCode(code: string): void {
  try {
    store()?.setItem(CODE_STORAGE_KEY, code);
  } catch {
    // Same as writeProgress above — nothing to recover mid-session.
  }
  notify();
}

/**
 * The cached code, following later saves — the school-computer bar shows the
 * code autosave mints. Null on the server and on the first render.
 */
export function useLocalProgressCode(): string | null {
  return useSyncExternalStore(subscribe, loadLocalProgressCode, () => null);
}

// ---- School computers -----------------------------------------------------

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

let saveStatus: SaveStatus = 'idle';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saving: Promise<void> | null = null;

function setSaveStatus(next: SaveStatus) {
  saveStatus = next;
  notify();
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveProgressNow();
  }, SAVE_DELAY_MS);
}

/** Posts this browser's progress under its code (minting one on the first save) and caches the code. */
export async function saveProgressNow(): Promise<void> {
  if (saving) await saving;
  const progress = readProgress();
  if (progress === EMPTY_PROGRESS) return;
  setSaveStatus('saving');
  saving = (async () => {
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: loadLocalProgressCode() ?? undefined, state: progress })
      });
      if (!response.ok) throw new Error('save failed');
      const data: { code: string } = await response.json();
      // Dropped while the request was out: the code belongs to the student who left, not to this screen.
      if (readProgress() !== EMPTY_PROGRESS) saveLocalProgressCode(normalizeProgressCode(data.code));
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  })();
  await saving;
  saving = null;
}

/** Saves now whatever is waiting — before a student leaves, so the code they write down holds everything. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await saveProgressNow();
  } else if (saving) {
    await saving;
  }
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => saveStatus, () => 'idle');
}

/**
 * A key press or click on a school computer: drops the last student's
 * progress if they walked away, then marks this moment as active.
 */
export function noteActivity(): void {
  if (!onSchoolComputer()) return;
  dropIfIdleAndNotify();
  touch();
}

function touch() {
  try {
    sessionStorage.setItem(ACTIVE_STORAGE_KEY, String(Date.now()));
  } catch {
    // Nothing stored, nothing to protect.
  }
}

/** For a timer: drops a walked-away student's progress even if nobody touches the screen. */
export function dropIfIdleAndNotify(): void {
  if (dropIfIdle()) {
    setSaveStatus('idle');
    notify();
  }
}

/** Finish on a school computer: this browser forgets the student. */
export function clearLocalPractice(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const target = store();
    target?.removeItem(PROGRESS_STORAGE_KEY);
    target?.removeItem(CODE_STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_STORAGE_KEY);
  } catch {
    // Nothing stored to remove.
  }
  saveStatus = 'idle';
  notify();
}

/** Both stores at once — when a PC is marked or unmarked (lib/device/school-client.ts). */
export function clearAllLocalPractice(): void {
  for (const target of [() => localStorage, () => sessionStorage]) {
    try {
      target().removeItem(PROGRESS_STORAGE_KEY);
      target().removeItem(CODE_STORAGE_KEY);
      target().removeItem(ACTIVE_STORAGE_KEY);
    } catch {
      // Unavailable storage holds nothing.
    }
  }
  saveStatus = 'idle';
  notify();
}

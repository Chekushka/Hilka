'use client';

/**
 * What the student has typed, dragged or chosen in a task, kept while they
 * look at another one (project owner: switching tasks used to throw the work
 * away). One draft per task version, under a scope:
 *
 * - a session: `session:<code>:<roster id>`, in `sessionStorage` — per tab,
 *   gone with the browser, like the room's chosen name (docs/AI_CONTEXT.md,
 *   "School Computers"), so the next student on a shared PC never sees it;
 * - practice: `practice`, where practice progress lives — `localStorage`, or
 *   `sessionStorage` on a school computer, dropped with the progress when the
 *   student walks away (lib/practice/local-progress.ts).
 *
 * A draft is the student's own answer in progress, never personal data, and
 * never sent anywhere: what counts is still only what a Check submits.
 *
 * Read through `useSyncExternalStore`, whose server snapshot is "no draft", so
 * a server-rendered task hydrates as the server drew it and the draft appears
 * in the next render — the same mismatch-free pattern as the room's stored
 * student. A component whose child owns its own copy of the value after mount
 * (CodeMirror) remounts that child once, keyed on `useHydrated`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { hasSchoolMark } from '@/lib/device/school';

export const DRAFT_KEY_PREFIX = 'hilka:draft:';
export const PRACTICE_DRAFT_SCOPE = 'practice';

export function sessionDraftScope(code: string, studentId: string): string {
  return `session:${code}:${studentId}`;
}

export function draftKey(scope: string, task: { id: string; version: number }): string {
  return `${DRAFT_KEY_PREFIX}${scope}:${task.id}:v${task.version}`;
}

function storageFor(scope: string): Storage | null {
  try {
    if (scope !== PRACTICE_DRAFT_SCOPE) return sessionStorage;
    return hasSchoolMark(document.cookie) ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() {
  listeners.forEach((listener) => listener());
}

function readRaw(scope: string, key: string): string | null {
  try {
    return storageFor(scope)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Removes one scope's drafts, or every draft without a scope, from one storage — used when practice data is wiped. */
export function removeDrafts(storage: Storage, scope?: string): void {
  const prefix = scope === undefined ? DRAFT_KEY_PREFIX : `${DRAFT_KEY_PREFIX}${scope}:`;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  if (keys.length > 0) notify();
}

function parseDraft<T>(raw: string | null, isValid: (value: unknown) => value is T): T | undefined {
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const noSubscription = () => () => {};

/** False during the server render and hydration, true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

type Update<T> = T | ((previous: T) => T);

/**
 * `useState`, kept as a draft when `scope` is set. `isValid` guards what comes
 * back from storage — an older shape, or a hand-edited value, falls back to
 * `initial` rather than breaking the task.
 */
export function useDraft<T>(
  scope: string | undefined,
  task: { id: string; version: number },
  initial: T | (() => T),
  isValid: (value: unknown) => value is T
): [T, (update: Update<T>) => void] {
  const [local, setLocal] = useState<T>(initial);
  const key = scope ? draftKey(scope, task) : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => (scope && key ? readRaw(scope, key) : null),
    () => null
  );
  // isValid is a pure guard per task type; the raw string is what changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stored = useMemo(() => parseDraft(raw, isValid), [raw]);
  const value = stored === undefined ? local : stored;
  // What a functional update starts from before anything was stored: the in-memory value.
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  const set = useCallback(
    (update: Update<T>) => {
      if (!scope || !key) {
        setLocal(update);
        return;
      }
      // Storage is written synchronously on every change, so it is the latest value.
      const previous = parseDraft(readRaw(scope, key), isValid) ?? localRef.current;
      const next = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update;
      localRef.current = next;
      setLocal(next);
      try {
        storageFor(scope)?.setItem(key, JSON.stringify(next));
      } catch {
        // Full or blocked storage: the draft lives in memory for this visit.
      }
      notify();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, key]
  );

  return [value, set];
}

export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isInteger(item));

export const isStringRecord = (value: unknown): value is Record<number, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((item) => typeof item === 'string');

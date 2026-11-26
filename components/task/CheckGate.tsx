'use client';

/**
 * A pause before a Check that counts. In a graded session a Check is final or
 * close to it, so the student is asked in the middle of the screen — with what
 * the attempt costs and what the task is judged on — and hands in only on a
 * deliberate yes (project owner: students must notice it and understand it).
 *
 * The page that knows the rules (SessionRoom) provides the gate; every Check
 * button reads it through `useGatedCheck`, so the six task views need no
 * prop of their own, and with no gate (practice, a route task, a task with no
 * Checks to lose) a Check goes straight through as before.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { t } from '@/lib/i18n';

/** Asks first, then runs `proceed` only on a yes. */
export type CheckGate = (proceed: () => void) => void;

const CheckGateContext = createContext<CheckGate | null>(null);

export function CheckGateProvider({ gate, children }: { gate: CheckGate | null; children: ReactNode }) {
  return <CheckGateContext.Provider value={gate}>{children}</CheckGateContext.Provider>;
}

/** `onCheck`, asked about first whenever the page set a gate. */
export function useGatedCheck(onCheck: () => void): () => void {
  const gate = useContext(CheckGateContext);
  return gate ? () => gate(onCheck) : onCheck;
}

/**
 * The question itself: a modal `<dialog>`, so it sits over the whole screen,
 * traps focus and closes on Escape. Focus starts on "keep working" — Enter
 * pressed out of habit must not hand the task in.
 */
export function ConfirmCheckDialog({
  open,
  onConfirm,
  onCancel,
  children
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** What this attempt costs and what the task is judged on. */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-check-title"
      data-testid="confirm-check"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-2 border-accent bg-surface p-0 text-ink shadow-[var(--shadow-raised)] backdrop:bg-ink/60"
    >
      {open && (
        <div className="space-y-4 p-6">
          <h2 id="confirm-check-title" className="text-2xl font-bold text-ink">
            {t('confirmCheck.title')}
          </h2>
          <div className="space-y-3 text-base">{children}</div>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-12 items-center rounded-xl border-2 border-line bg-shell px-5 py-2.5 text-base font-semibold text-ink hover:border-accent"
            >
              {t('confirmCheck.no')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex min-h-12 items-center rounded-xl bg-growth px-6 py-2.5 text-base font-bold text-on-bright hover:brightness-105"
            >
              {t('confirmCheck.yes')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

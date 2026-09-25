'use client';

/**
 * The way forward after a passed Check, shown inside the success result so a
 * student never has to hunt for it. What "next" means belongs to the caller —
 * a lesson's next step in practice (a link), the session's next open task (a
 * state change inside SessionRoom) — so the task-type views stay unaware of
 * either (docs/AI_CONTEXT.md, "Every task type implements one shared component
 * interface").
 */
import Link from 'next/link';

export type NextTaskAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'button'; onSelect: () => void; label: string };

const className =
  'mt-3 inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-surface';

export function NextTaskButton({ action }: { action: NextTaskAction }) {
  if (action.kind === 'link') {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onSelect} className={className}>
      {action.label}
    </button>
  );
}

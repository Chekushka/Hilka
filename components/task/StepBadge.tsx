/**
 * The number of a workspace zone: 1 the task, 2 the answer, 3 the result
 * (WorkspaceFrame, WorkspaceDock). The same three steps in every task type and
 * every mode, so the order of work is visible before anything is read.
 * Decorative: each zone's own label says what it is.
 */
export function StepBadge({ n, inverted = false }: { n: 1 | 2 | 3; inverted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm font-bold ${
        inverted ? 'bg-surface text-accent' : 'bg-accent text-surface'
      }`}
    >
      {n}
    </span>
  );
}

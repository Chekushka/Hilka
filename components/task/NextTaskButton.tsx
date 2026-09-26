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
import { Plant } from '@/components/meta/Plant';
import type { PlantStage } from '@/lib/meta/garden';

export type NextTaskAction = (
  | { kind: 'link'; href: string; label: string }
  | { kind: 'button'; onSelect: () => void; label: string }
) & {
  /** What this pass earned — practice only, and only on a task's first pass. */
  reward?: {
    /** e.g. "+30 XP". */
    xp: string;
    /** Set when the pass made the topic's plant grow: its new stage, and that said in words. */
    growth?: { stage: PlantStage; label: string };
  };
};

const className =
  'mt-3 inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-surface';

export function NextTaskButton({ action }: { action: NextTaskAction }) {
  const button =
    action.kind === 'link' ? (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    ) : (
      <button type="button" onClick={action.onSelect} className={className}>
        {action.label}
      </button>
    );
  const { reward } = action;
  if (!reward) return button;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        {button}
        <span className="mt-3 text-lg font-semibold text-honey" data-testid="xp-earned">
          {reward.xp}
        </span>
      </div>
      {reward.growth && (
        <p className="mt-1 flex items-end gap-2 text-sm text-growth" data-testid="garden-growth">
          <Plant stage={reward.growth.stage} size={36} />
          {reward.growth.label}
        </p>
      )}
    </div>
  );
}

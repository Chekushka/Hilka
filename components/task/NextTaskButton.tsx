'use client';

/**
 * The way forward after a passed Check. What "next" means belongs to the
 * caller — a lesson's next step in practice (a link), the session's next open
 * task (a state change inside SessionRoom) — so the task-type views stay
 * unaware of either (docs/AI_CONTEXT.md, "Every task type implements one
 * shared component interface"). What the pass earned travels with the action
 * and is shown by SuccessPanel, not here.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CharacterLook } from '@/lib/meta/character';
import type { PlantSpecies, PlantStage } from '@/lib/meta/garden';

export type NextTaskAction = (
  | { kind: 'link'; href: string; label: string }
  | { kind: 'button'; onSelect: () => void; label: string }
) & {
  /** A word or two for the result dock's bar, where Run and Check already take the room — `result.nextShort`. */
  shortLabel?: string;
  /** What this pass earned — practice only, and only on a task's first pass. */
  reward?: {
    /** e.g. "+30 XP". */
    xp: string;
    /** Set when the pass made the topic's plant grow: its new stage, and that said in words. */
    growth?: { stage: PlantStage; species: PlantSpecies; label: string };
    /** The character after this pass: total XP, the look it wears, its level in words. */
    character?: {
      xp: number;
      look: CharacterLook;
      label: string;
      /** Set when this pass reached a new level: that said, and what it unlocked. */
      levelUp?: { title: string; unlocked: string };
    };
  };
};

const defaultClassName =
  'mt-3 inline-flex items-center rounded-md bg-accent px-5 py-2.5 text-base font-semibold text-surface';

export function NextTaskButton({
  action,
  className = defaultClassName,
  children = action.label
}: {
  action: NextTaskAction;
  className?: string;
  /** In place of `action.label`, e.g. the short label with an arrow. */
  children?: ReactNode;
}) {
  return action.kind === 'link' ? (
    <Link href={action.href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={action.onSelect} className={className}>
      {children}
    </button>
  );
}

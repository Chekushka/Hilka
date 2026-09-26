/**
 * The garden (docs/design-brief-python-platform.md, "Meta layer — the
 * garden"): one plant per topic, grown by the share of that topic's practice
 * tasks a student has passed. Derived from the same completed slugs as XP
 * (lib/meta/progress.ts), never stored — nothing to merge when a progress
 * code is restored, and nothing to wither: a plant never shrinks unless its
 * topic gains tasks.
 */

/** 0 seed · 1 sprout · 2 young plant · 3 bud · 4 in flower. */
export type PlantStage = 0 | 1 | 2 | 3 | 4;

export const MAX_PLANT_STAGE: PlantStage = 4;

/**
 * Nothing done is a seed and everything done is a flower — only a finished
 * topic flowers, so the flower means something. In between, the three
 * growing stages split the share evenly, and the first solved task always
 * sprouts: the first win has to be visible.
 */
export function plantStage(done: number, total: number): PlantStage {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return MAX_PLANT_STAGE;
  return (1 + Math.min(2, Math.floor((done * 3) / total))) as PlantStage;
}

/**
 * The stage a topic's plant reaches if `slug` is passed now, or null when
 * that pass does not make it grow (already done, or not enough to move it).
 */
export function stageGainedByPass(
  topicSlugs: readonly string[],
  completed: ReadonlySet<string>,
  slug: string
): PlantStage | null {
  const unique = new Set(topicSlugs);
  if (!unique.has(slug) || completed.has(slug)) return null;
  const done = [...unique].filter((taskSlug) => completed.has(taskSlug)).length;
  const before = plantStage(done, unique.size);
  const after = plantStage(done + 1, unique.size);
  return after > before ? after : null;
}

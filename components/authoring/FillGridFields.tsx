'use client';

import type { GridWorld } from '@/lib/runner';
import { t } from '@/lib/i18n';
import { GridWorldField } from './GridWorldField';

/**
 * `fill` has no surface field (docs/TASK_SCHEMA.md, "Grid"): a world on the
 * payload is what puts the gaps on the grid. A switch, then the same world
 * editor the code and fix forms use.
 */
export function FillGridFields({
  on,
  onToggle,
  world,
  onWorldChange
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  world: GridWorld;
  onWorldChange: (world: GridWorld) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={on} onChange={(event) => onToggle(event.target.checked)} />
        {t('authoring.fillGridLabel')}
      </label>
      {on && (
        <>
          <p className="text-xs text-ink-muted">{t('authoring.fillGridHint')}</p>
          <GridWorldField value={world} onChange={onWorldChange} />
        </>
      )}
    </div>
  );
}

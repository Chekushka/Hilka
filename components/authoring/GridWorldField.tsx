'use client';

/**
 * Builds a grid task's world by clicking the field (docs/TASK_SCHEMA.md,
 * "Grid"): pick what to place — the robot, the battery, a rock — and click a
 * cell. The robot and the battery move; a rock toggles. The field is drawn
 * by the same GridView the student sees, with a layer of buttons over it, so
 * the author edits exactly what the class will get.
 */
import { useState } from 'react';
import { GridView } from '@/components/canvas/GridView';
import { t } from '@/lib/i18n';
import type { GridDir, GridWorld } from '@/lib/runner';
import { GRID_SIZE, placeOnGrid, type GridTool } from '@/lib/task/grid';

const DIRS: GridDir[] = ['E', 'N', 'W', 'S'];

export function GridWorldField({ value, onChange }: { value: GridWorld; onChange: (world: GridWorld) => void }) {
  const [tool, setTool] = useState<GridTool>('rock');

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-line bg-surface px-3 py-3">
      <legend className="px-1 text-sm text-ink-muted">{t('authoring.gridLabel')}</legend>
      <p className="text-sm text-ink-muted">{t('authoring.gridNote')}</p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink">
        <span className="text-ink-muted">{t('authoring.gridTool')}:</span>
        {(['start', 'goal', 'rock'] as const).map((option) => (
          <label key={option} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="grid-tool"
              checked={tool === option}
              onChange={() => setTool(option)}
              className="accent-accent"
            />
            {t(`authoring.gridTool${option === 'start' ? 'Start' : option === 'goal' ? 'Goal' : 'Rock'}`)}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        {t('authoring.gridDir')}
        <select
          value={value.start.dir}
          onChange={(event) => onChange({ ...value, start: { ...value.start, dir: event.target.value as GridDir } })}
          className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
        >
          {DIRS.map((dir) => (
            <option key={dir} value={dir}>
              {t(`grid.dir${dir}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="relative w-full max-w-[360px]">
        <GridView world={value} steps={[]} />
        <div className="absolute inset-0 grid grid-cols-8 gap-[3px] p-2">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const cell = { x: i % GRID_SIZE, y: Math.floor(i / GRID_SIZE) };
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(placeOnGrid(value, tool, cell))}
                aria-label={t('authoring.gridCell', { x: cell.x + 1, y: cell.y + 1 })}
                className="rounded-md hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent"
              />
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

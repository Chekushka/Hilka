'use client';

/**
 * The work area for the task types that execute: a code surface (named by
 * the work area's bar in WorkspaceFrame), and — when the task draws or moves the grid robot — that
 * picture beside it rather than under it, so the picture and the code that
 * made it are on screen together at 1366×768.
 */
import type { ReactNode } from 'react';
import { GridPlayback } from '@/components/canvas/GridView';
import { PlaybackScrubber } from '@/components/canvas/PlaybackScrubber';
import { t } from '@/lib/i18n';
import type { GridRun, GridWorld, Segment } from '@/lib/runner';

interface CodePaneProps {
  /** Above the code surface, e.g. file delivery's download/upload. */
  before?: ReactNode;
  /** The editor, or fill's template. */
  children: ReactNode;
  /** The turtle canvas or the grid (`CodeVisual`); absent on a console task. */
  visual?: ReactNode;
}

export function CodePane({ before, children, visual }: CodePaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-code-bg">
        {before && <div className="flex-none border-b border-line bg-surface p-4">{before}</div>}
        <div className="flex min-h-[16rem] flex-1 flex-col lg:min-h-0">{children}</div>
      </div>
      {visual && (
        <figure className="flex flex-none flex-col items-center justify-center gap-2 border-t border-line bg-bg p-4 lg:w-[25rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {visual}
        </figure>
      )}
    </div>
  );
}

/** What a runnable task shows beside its code: the grid when it has a world, else the turtle canvas. */
export function CodeVisual({
  world,
  grid,
  drawing,
  target
}: {
  world?: GridWorld;
  grid: GridRun | null;
  drawing: Segment[];
  target: Segment[];
}) {
  if (world) return <GridPlayback world={world} run={grid} />;
  return (
    <>
      <PlaybackScrubber drawing={drawing} target={target} />
      <figcaption className="text-xs text-ink-muted">
        {t('workspace.yourDrawing')} · {t('workspace.target')}
      </figcaption>
    </>
  );
}

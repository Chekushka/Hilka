'use client';

/**
 * The work area for the task types that execute: a code surface under a thin
 * bar that names it, and — when the task draws — the turtle canvas beside it
 * rather than under it, so the drawing and the code that made it are on
 * screen together at 1366×768.
 */
import type { ReactNode } from 'react';
import { PlaybackScrubber } from '@/components/canvas/PlaybackScrubber';
import { t } from '@/lib/i18n';
import type { Segment } from '@/lib/runner';

interface CodePaneProps {
  /** Above the code surface, e.g. file delivery's download/upload. */
  before?: ReactNode;
  /** The editor, or fill's template. */
  children: ReactNode;
  /** Present when the task draws. */
  canvas?: { drawing: Segment[]; target: Segment[] };
}

export function CodePane({ before, children, canvas }: CodePaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-code-bg">
        <div className="flex h-10 flex-none items-center gap-3 border-b border-line px-5">
          <span className="text-sm font-semibold text-ink">{t('workspace.editorLabel')}</span>
          <span className="flex-1" />
          <span className="text-xs text-ink-muted">{t('workspace.editorEngine')}</span>
        </div>
        {before && <div className="flex-none border-b border-line bg-surface p-4">{before}</div>}
        <div className="flex min-h-[16rem] flex-1 flex-col lg:min-h-0">{children}</div>
      </div>
      {canvas && (
        <figure className="flex flex-none flex-col items-center justify-center gap-2 border-t border-line bg-bg p-4 lg:w-[25rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <PlaybackScrubber drawing={canvas.drawing} target={canvas.target} />
          <figcaption className="text-xs text-ink-muted">
            {t('workspace.yourDrawing')} · {t('workspace.target')}
          </figcaption>
        </figure>
      )}
    </div>
  );
}

'use client';

/**
 * Steps the student's drawing back into being, one turtle call at a time —
 * the step-by-step-execution lesson (grade 7, lesson 40) asks for, without an
 * interpreter-level stepper (AI_CONTEXT.md, "Turtle"). Driven by position in
 * `drawing`, the order the calls actually happened in, because
 * `Segment.line` is always null (see lib/canvas/playback.ts).
 */
import { useEffect, useState } from 'react';
import { TurtleCanvas } from './TurtleCanvas';
import { clampStep, isFinished, stepBy } from '@/lib/canvas/playback';
import { t } from '@/lib/i18n';
import type { Segment } from '@/lib/runner';

interface PlaybackScrubberProps {
  drawing: Segment[];
  target?: Segment[];
  width?: number;
  height?: number;
}

const STEP_MS = 400;

export function PlaybackScrubber({ drawing, target = [], width, height }: PlaybackScrubberProps) {
  const total = drawing.length;
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  // A new run replaces the drawing outright — show it complete, not mid
  // playback of whatever the previous run left the scrubber at. Adjusted
  // during render (React's documented pattern for resetting state when a
  // prop changes) rather than in an effect, so it happens in the same pass.
  const [prevDrawing, setPrevDrawing] = useState(drawing);
  if (drawing !== prevDrawing) {
    setPrevDrawing(drawing);
    setStep(total);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setStep((s) => {
        const next = stepBy(s, 1, total);
        if (isFinished(next, total)) setPlaying(false);
        return next;
      });
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [playing, step, total]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    // Replaying after reaching the end starts over rather than doing nothing.
    if (isFinished(step, total)) setStep(0);
    setPlaying(true);
  }

  function goTo(next: number) {
    setPlaying(false);
    setStep(clampStep(next, total));
  }

  return (
    <div>
      <TurtleCanvas
        drawing={drawing.slice(0, step)}
        target={target}
        width={width}
        height={height}
        label={t('workspace.yourDrawing')}
        highlightLast={step > 0 && step < total}
      />
      {total > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? t('workspace.playbackPause') : t('workspace.playbackPlay')}
            className="rounded-md border border-line px-2 py-1 text-sm text-ink"
          >
            {playing ? t('workspace.playbackPause') : t('workspace.playbackPlay')}
          </button>
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            aria-label={t('workspace.playbackPrev')}
            className="rounded-md border border-line px-2 py-1 text-sm text-ink disabled:opacity-40"
          >
            ‹
          </button>
          <input
            type="range"
            min={0}
            max={total}
            value={step}
            onChange={(e) => goTo(Number(e.target.value))}
            aria-label={t('workspace.playbackScrubber')}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            disabled={step === total}
            aria-label={t('workspace.playbackNext')}
            className="rounded-md border border-line px-2 py-1 text-sm text-ink disabled:opacity-40"
          >
            ›
          </button>
          <span className="text-xs text-ink-muted">{t('workspace.playbackStep', { step, total })}</span>
        </div>
      )}
    </div>
  );
}

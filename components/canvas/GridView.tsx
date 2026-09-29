'use client';

/**
 * The 8×8 grid and its robot (docs/design-brief-python-platform.md, "Student
 * — grid and character"; docs/mockups, the grid screen). Flat and simple —
 * CSS and a few SVG shapes, not a rendering engine. Every cell kind is a
 * different shape (robot, battery, rock, trail dot, bump diamond), so nothing
 * relies on colour alone, and the whole field says where the robot is in its
 * accessible name.
 *
 * `GridPlayback` steps the robot's recorded path back into being, the grid's
 * counterpart of the turtle's PlaybackScrubber: shown complete after a run,
 * replayable one move at a time.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { clampStep, isFinished, stepBy } from '@/lib/canvas/playback';
import { t } from '@/lib/i18n';
import type { GridCell, GridDir, GridRun, GridStep, GridWorld } from '@/lib/runner';

const SIZE = 8;
const ROTATION: Record<GridDir, number> = { N: 0, E: 90, S: 180, W: 270 };
const STEP_MS = 350;

/** Seen from above, facing up; rotated to face its direction. The nose says which way it looks. */
function Robot({ dir, bumped }: { dir: GridDir; bumped: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[78%] w-[78%] transition-transform duration-200 motion-reduce:transition-none"
      style={{ transform: `rotate(${ROTATION[dir]}deg)` }}
      aria-hidden="true"
    >
      <path d="M12 1.5 L15.5 6 H8.5 Z" className="fill-accent" />
      <rect x="4" y="6" width="16" height="15" rx="4.5" className={bumped ? 'fill-attention' : 'fill-accent'} />
      <circle cx="9" cy="11" r="1.8" className="fill-surface" />
      <circle cx="15" cy="11" r="1.8" className="fill-surface" />
      <rect x="9.5" y="15.5" width="5" height="2.5" rx="1" className="fill-honey" />
    </svg>
  );
}

function Battery() {
  return (
    <svg viewBox="0 0 24 24" className="h-[64%] w-[64%]" aria-hidden="true">
      <rect x="2.5" y="7" width="17" height="10" rx="2.5" fill="none" strokeWidth="2.2" className="stroke-honey" />
      <rect x="20" y="10" width="2.2" height="4" rx="0.8" className="fill-honey" />
      <rect x="5" y="9.5" width="4" height="5" rx="0.8" className="fill-honey" />
      <rect x="10" y="9.5" width="4" height="5" rx="0.8" className="fill-honey" />
    </svg>
  );
}

function Rock() {
  return (
    <svg viewBox="0 0 24 24" className="h-[72%] w-[72%]" aria-hidden="true">
      <path d="M3 19 C3 13 6 9 10 8.5 C12 6 16 6 18 9 C21 10.5 22 15 21 19 Z" className="fill-ink-muted" />
      <path d="M8 12 C9.5 10.5 11 10.5 12 11" fill="none" strokeWidth="1.3" strokeLinecap="round" className="stroke-surface opacity-50" />
    </svg>
  );
}

const key = (cell: GridCell) => `${cell.x},${cell.y}`;

export function GridView({ world, steps, label }: { world: GridWorld; steps: GridStep[]; label?: string }) {
  const robot = steps[steps.length - 1] ?? { ...world.start, bump: false };
  const rocks = new Set(world.rocks.map(key));
  const trail = new Set(steps.slice(0, -1).map(key));
  const bumps = new Set(steps.filter((step) => step.bump).map(key));
  const accessibleName = [
    label ??
      t('grid.label', {
        x: robot.x + 1,
        y: robot.y + 1,
        dir: t(`grid.dir${robot.dir}`),
        gx: world.goal.x + 1,
        gy: world.goal.y + 1
      }),
    robot.bump ? t('grid.labelBump') : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="img"
      aria-label={accessibleName}
      className="grid w-full max-w-[360px] grid-cols-8 gap-[3px] rounded-xl bg-shell p-2"
    >
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const cell = { x: i % SIZE, y: Math.floor(i / SIZE) };
        const id = key(cell);
        const here = robot.x === cell.x && robot.y === cell.y;
        const isGoal = world.goal.x === cell.x && world.goal.y === cell.y;
        return (
          <div
            key={id}
            className={`relative flex aspect-square items-center justify-center rounded-md ${
              isGoal ? 'bg-honey/15' : 'bg-surface'
            } ${here && robot.bump ? 'ring-2 ring-attention' : ''}`}
          >
            {rocks.has(id) && <Rock />}
            {isGoal && !here && <Battery />}
            {!here && !isGoal && trail.has(id) && <span className="h-2 w-2 rounded-full bg-growth" />}
            {bumps.has(id) && !here && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rotate-45 bg-attention" aria-hidden="true" />
            )}
            {here && <Robot dir={robot.dir} bumped={robot.bump} />}
          </div>
        );
      })}
    </div>
  );
}

function LegendItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
        {children}
      </span>
      {label}
    </li>
  );
}

export function GridLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      <LegendItem label={t('grid.legendRobot')}>
        <Robot dir="N" bumped={false} />
      </LegendItem>
      <LegendItem label={t('grid.legendGoal')}>
        <Battery />
      </LegendItem>
      <LegendItem label={t('grid.legendRock')}>
        <Rock />
      </LegendItem>
      <LegendItem label={t('grid.legendPath')}>
        <span className="h-2 w-2 rounded-full bg-growth" />
      </LegendItem>
      <LegendItem label={t('grid.legendBump')}>
        <span className="h-2 w-2 rotate-45 bg-attention" />
      </LegendItem>
    </ul>
  );
}

export function GridPlayback({ world, run }: { world: GridWorld; run: GridRun | null }) {
  const steps = run?.steps ?? [];
  const total = Math.max(0, steps.length - 1);
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  // A new run shows its end result at once, same as the turtle scrubber.
  const [prevRun, setPrevRun] = useState(run);
  if (run !== prevRun) {
    setPrevRun(run);
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
    if (isFinished(step, total)) setStep(0);
    setPlaying(true);
  }

  function goTo(next: number) {
    setPlaying(false);
    setStep(clampStep(next, total));
  }

  return (
    <div className="flex w-full max-w-[360px] flex-col gap-2">
      <GridView world={world} steps={steps.slice(0, step + 1)} />
      {total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? t('workspace.playbackPause') : t('workspace.playbackPlay')}
              className="rounded-md border border-line px-2 py-1 text-sm text-ink"
            >
              {playing ? t('workspace.playbackPause') : t('workspace.playbackPlay')}
            </button>
            <span className="text-xs text-ink-muted">{t('workspace.playbackStep', { step, total })}</span>
          </div>
          <div className="flex items-center gap-2">
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
              aria-label={t('grid.playbackScrubber')}
              className="min-w-0 flex-1 accent-accent"
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
          </div>
        </div>
      )}
      <GridLegend />
    </div>
  );
}

/**
 * The run said in words, in the result dock: where the robot ended, or where
 * it bumped. The picture shows it; this is for the student who reads rather
 * than looks, and for whoever cannot tell the diamond from the dot.
 */
export function GridRunNote({ run }: { run: GridRun | null }) {
  if (!run) return <p className="text-sm text-ink-muted">{t('grid.noteUnused')}</p>;
  const bump = run.steps.find((step) => step.bump);
  const last = run.steps[run.steps.length - 1];
  if (bump) {
    return (
      <p className="flex items-center gap-2 text-sm text-attention">
        <span aria-hidden="true" className="h-2 w-2 flex-none rotate-45 bg-attention" />
        {t('grid.noteBump', { x: bump.x + 1, y: bump.y + 1 })}
      </p>
    );
  }
  if (run.reachedGoal) return <p className="text-sm text-growth">{t('grid.noteGoal')}</p>;
  return <p className="text-sm text-ink-muted">{t('grid.noteStopped', { x: last.x + 1, y: last.y + 1 })}</p>;
}

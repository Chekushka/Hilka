'use client';

/**
 * The theory's pictures (lib/lessons/visuals.ts): the computer's memory as
 * labelled boxes the student steps through line by line, and a flowchart of a
 * branch or a loop. Display only — nothing here runs code; the memory values
 * were proven by a run when the lesson was saved. Every state has a word or a
 * shape besides its colour (docs/design-brief-python-platform.md), and the
 * only movement is a one-shot highlight of the box that just changed.
 */
import { useState } from 'react';
import { highlightCode } from '@/lib/lessons/highlight';
import { memoryBoxes, parseFlow, parseMemory } from '@/lib/lessons/visuals';
import { t } from '@/lib/i18n';
import { CodeView, Tokens } from './TheoryBits';

function CodeLine({ text }: { text: string }) {
  const [tokens] = highlightCode(text);
  return (
    <code className="whitespace-pre font-mono text-[0.95rem] text-ink">
      <Tokens tokens={tokens ?? []} />
    </code>
  );
}

/** A ```memory block: the code with a pointer on the line just run, and the boxes as they are after it. */
export function MemoryView({ text }: { text: string }) {
  const memory = parseMemory(text);
  const [step, setStep] = useState(0);
  if (memory.problems.length > 0) return <CodeView text={text} />;
  const boxes = memoryBoxes(memory, step);
  const last = memory.steps.length - 1;
  return (
    <div className="overflow-hidden rounded-xl border-2 border-line bg-surface" data-testid="theory-memory">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ol className="bg-code-bg py-2" aria-label={t('theory.memoryCode')}>
          {memory.steps.map((current, index) => {
            const state = index === step ? 'now' : index < step ? 'done' : 'later';
            return (
              <li
                key={index}
                aria-current={state === 'now' ? 'step' : undefined}
                className={`flex items-center gap-2 py-1 pr-4 leading-7 ${
                  state === 'now' ? 'bg-honey-soft' : state === 'later' ? 'opacity-45' : ''
                }`}
              >
                <span aria-hidden="true" className="w-8 flex-none text-right font-bold text-honey-ink">
                  {state === 'now' ? '▶' : state === 'done' ? '✓' : ''}
                </span>
                <CodeLine text={current.line} />
              </li>
            );
          })}
        </ol>
        <section aria-live="polite" aria-label={t('theory.memoryTitle')} className="flex flex-col gap-3 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <MemoryIcon />
            {t('theory.memoryTitle')}
          </p>
          {boxes.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('theory.memoryEmpty')}</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {boxes.map((box) => (
                <li
                  // A changed box remounts at every step, so its highlight plays each time.
                  key={box.changed ? `${box.name}@${step}` : box.name}
                  data-changed={box.changed ? 'true' : undefined}
                  className={`flex min-w-24 flex-col overflow-hidden rounded-lg border-2 ${
                    box.changed ? 'memory-pop border-honey' : 'border-line'
                  }`}
                >
                  <span className={`px-3 py-1 text-xs font-bold ${box.changed ? 'bg-honey text-on-bright' : 'bg-shell text-ink-muted'}`}>
                    {box.name}
                    {box.changed && <span className="ml-1 font-semibold">· {t('theory.memoryChanged')}</span>}
                  </span>
                  <span className="flex items-baseline gap-2 px-3 py-2 font-mono text-xl font-bold text-ink">
                    {box.previous !== null && (
                      <span className="text-base font-normal text-ink-muted line-through" aria-label={t('theory.memoryWas', { value: box.previous })}>
                        {box.previous}
                      </span>
                    )}
                    {box.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-line px-4 py-2.5">
        <button
          type="button"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0}
          className="rounded-lg border-2 border-line px-3 py-1 text-sm font-semibold text-ink disabled:opacity-40"
        >
          ← {t('theory.memoryBack')}
        </button>
        <button
          type="button"
          onClick={() => setStep((value) => Math.min(last, value + 1))}
          disabled={step === last}
          className="rounded-lg border-2 border-accent bg-accent-soft px-3 py-1 text-sm font-bold text-accent disabled:opacity-40"
          data-testid="memory-next"
        >
          {t('theory.memoryNext')} →
        </button>
        <span className="text-sm text-ink-muted" data-testid="memory-step">
          {t('theory.memoryStep', { n: step + 1, total: memory.steps.length })}
        </span>
      </div>
    </div>
  );
}

function MemoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 flex-none">
      <rect x="1.5" y="3" width="5.5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="3" width="5.5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="10" width="13" height="3" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function Statements({ lines, tone }: { lines: string[]; tone: 'yes' | 'no' | 'plain' }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border-2 bg-code-bg px-3 py-2 ${
        tone === 'yes' ? 'border-growth' : tone === 'no' ? 'border-attention' : 'border-line'
      }`}
    >
      {lines.length === 0 ? <span className="text-sm text-ink-muted">{t('theory.flowNothing')}</span> : lines.map((line, i) => <CodeLine key={i} text={line} />)}
    </div>
  );
}

function Diamond({ condition }: { condition: string }) {
  return (
    <div className="flex justify-center">
      <div className="relative flex min-h-20 min-w-48 items-center justify-center px-10 py-4">
        <svg aria-hidden="true" viewBox="0 0 100 50" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polygon points="50,1 99,25 50,49 1,25" className="fill-accent-soft stroke-accent" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="relative flex items-center gap-1.5">
          <span aria-hidden="true" className="font-bold text-accent">?</span>
          <CodeLine text={condition} />
        </span>
      </div>
    </div>
  );
}

function Arrow({ label, mark, tone }: { label: string; mark: string; tone: 'yes' | 'no' | 'plain' }) {
  return (
    <span
      className={`flex items-center justify-center gap-1 py-1 text-sm font-bold ${
        tone === 'yes' ? 'text-growth' : tone === 'no' ? 'text-attention' : 'text-ink-muted'
      }`}
    >
      <span aria-hidden="true">↓</span>
      {mark && <span aria-hidden="true">{mark}</span>}
      {label}
    </span>
  );
}

/** A ```flow block: a diamond with the condition, and where each answer leads. */
export function FlowView({ text }: { text: string }) {
  const flow = parseFlow(text);
  if (flow.problems.length > 0) return <CodeView text={text} />;
  return (
    <figure className="rounded-xl border-2 border-line bg-surface p-4" data-testid="theory-flow" aria-label={t('theory.flowLabel')}>
      <Diamond condition={flow.condition} />
      {flow.kind === 'if' ? (
        <div className="mt-1 grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <Arrow label={t('theory.flowYes')} mark="✓" tone="yes" />
            <Statements lines={flow.yes} tone="yes" />
          </div>
          <div className="flex flex-col">
            <Arrow label={t('theory.flowNo')} mark="✗" tone="no" />
            <Statements lines={flow.no} tone="no" />
          </div>
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <Arrow label={t('theory.flowYes')} mark="✓" tone="yes" />
            <Statements lines={flow.body} tone="yes" />
            <span className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-accent">
              <span aria-hidden="true">↺</span>
              {t('theory.flowAgain')}
            </span>
          </div>
          <div className="flex flex-col">
            <Arrow label={t('theory.flowNoLoop')} mark="✗" tone="no" />
            <Statements lines={flow.after} tone="plain" />
          </div>
        </div>
      )}
    </figure>
  );
}

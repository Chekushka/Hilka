import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TurtleCanvas } from '@/components/canvas/TurtleCanvas';
import { DraftTaskEditor } from '@/components/authoring/DraftTaskEditor';
import { FillDraftEditor } from '@/components/authoring/FillDraftEditor';
import { FixDraftEditor } from '@/components/authoring/FixDraftEditor';
import { ParsonsDraftEditor } from '@/components/authoring/ParsonsDraftEditor';
import { PredictDraftEditor } from '@/components/authoring/PredictDraftEditor';
import { QuizDraftEditor } from '@/components/authoring/QuizDraftEditor';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getTaskForAuthoring } from '@/lib/db/task-authoring';
import { t } from '@/lib/i18n';
import type { TaskRow } from '@/lib/db/task-mapping';
import { PromptText } from '@/components/task/PromptText';
import { DifficultyMeter, TaskTypeChip } from '@/components/authoring/TaskBadges';
import { TaskTagsEditor } from '@/components/authoring/TaskTagsField';
import { normalizeTags } from '@/lib/task/tags';
import { authoringModeOf, editableContent, revisionBlocker } from '@/lib/task/revision';
import type { TaskRevision } from '@/lib/task/types';
import { RevisionFrame, StartRevision } from '@/components/authoring/TaskRevision';

export const dynamic = 'force-dynamic';

/** A published (or archived) `code` task as students see it now; editing it opens a revision (lib/task/revision.ts). */
function PublishedCodeView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'code') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      {task.payload.delivery === 'file' && task.payload.file && (
        <p className="text-sm text-ink-muted">
          {t('authoring.deliverySummary', {
            filename: task.payload.file.filename,
            kb: Math.round(task.payload.file.maxBytes / 1024)
          })}
        </p>
      )}
      <PromptText prompt={task.payload.prompt} className="text-ink" />

      {task.payload.surface === 'turtle' && (
        <TurtleCanvas drawing={task.reference?.artifacts?.drawing ?? []} label={t('workspace.target')} />
      )}
      {task.payload.surface === 'console' && task.reference?.artifacts?.stdout && (
        <pre className="whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference.artifacts.stdout}
        </pre>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.referenceTitle')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference?.code}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>

      {task.cases && task.cases.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.casesLabel')}</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
            {JSON.stringify(task.cases, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/** A published `parsons` task — the pool is derived, so this just lists the payload as-is. */
function PublishedParsonsView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'parsons') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <PromptText prompt={task.payload.prompt} className="text-ink" />
      <p className="text-sm text-ink-muted">
        {task.payload.indentMode === 'chosen'
          ? t('authoring.parsonsIndentModeChosen')
          : t('authoring.parsonsIndentModeGiven')}
      </p>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.parsonsLinesLabel')}</p>
        <ul className="mt-1 rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.lines.map((line, index) => (
            <li key={index}>
              {' '.repeat(line.indent * 2)}
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/** A published `quiz` task — the correct answer lives in `checks`, so this just lists the options and the checks as-is. */
function PublishedQuizView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'quiz') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <PromptText prompt={task.payload.prompt} className="text-ink" />

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.quizOptionsLabel')}</p>
        <ul className="mt-1 rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.options.map((option, index) => (
            <li key={index}>
              {index}: {option}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/** A published `predict` task — `payload.code` IS the reference, so this just shows it and the checks as-is. */
function PublishedPredictView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'predict') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <PromptText prompt={task.payload.prompt} className="text-ink" />

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.predictCodeLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.code}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/** A published `fix` task — the broken code stays fixed and read-only, same as the reference. */
function PublishedFixView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'fix') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      {task.payload.delivery === 'file' && task.payload.file && (
        <p className="text-sm text-ink-muted">
          {t('authoring.deliverySummary', {
            filename: task.payload.file.filename,
            kb: Math.round(task.payload.file.maxBytes / 1024)
          })}
        </p>
      )}
      <PromptText prompt={task.payload.prompt} className="text-ink" />

      {task.payload.surface === 'turtle' && (
        <TurtleCanvas drawing={task.reference?.artifacts?.drawing ?? []} label={t('workspace.target')} />
      )}
      {task.payload.surface === 'console' && task.reference?.artifacts?.stdout && (
        <pre className="whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference.artifacts.stdout}
        </pre>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.brokenCodeLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.broken}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.referenceTitle')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference?.code}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>

      {task.cases && task.cases.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.casesLabel')}</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
            {JSON.stringify(task.cases, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/** A published `fill` task — the template stays fixed and read-only, same as the reference. */
function PublishedFillView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'fill') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <PromptText prompt={task.payload.prompt} className="text-ink" />

      <TurtleCanvas drawing={task.reference?.artifacts?.drawing ?? []} label={t('workspace.target')} />
      {task.reference?.artifacts?.stdout && (
        <pre className="whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference.artifacts.stdout}
        </pre>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.templateLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.payload.template}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.referenceTitle')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-sm text-ink">
          {task.reference?.code}
        </pre>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted">{t('authoring.checksLabel')}</p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-code-bg p-3 font-mono text-xs text-ink">
          {JSON.stringify(task.checks, null, 2)}
        </pre>
      </div>
    </div>
  );
}

const AUTHORABLE_TYPES = ['code', 'parsons', 'quiz', 'predict', 'fix', 'fill'] as const;

/** The editor for a draft or an open revision, by type — the same component either way. */
function TaskEditor({
  id,
  content,
  initialReferenceCode
}: {
  id: string;
  content: TaskRevision;
  initialReferenceCode?: string;
}) {
  const { payload } = content;
  const common = {
    id,
    title: content.title,
    checks: content.checks,
    hints: content.hints,
    difficulty: content.difficulty,
    gradeTags: content.gradeTags
  };
  const cases = content.cases ?? undefined;
  switch (payload.type) {
    case 'code':
      return <DraftTaskEditor task={{ ...common, payload, cases }} initialReferenceCode={initialReferenceCode} />;
    case 'parsons':
      return <ParsonsDraftEditor task={{ ...common, payload }} />;
    case 'quiz':
      return <QuizDraftEditor task={{ ...common, payload }} />;
    case 'predict':
      return <PredictDraftEditor task={{ ...common, payload }} />;
    case 'fix':
      return <FixDraftEditor task={{ ...common, payload, cases }} initialReferenceCode={initialReferenceCode} />;
    case 'fill':
      return <FillDraftEditor task={{ ...common, payload }} initialReferenceCode={initialReferenceCode} />;
  }
}

function PublishedView({ task }: { task: TaskRow }) {
  switch (task.payload?.type) {
    case 'code':
      return <PublishedCodeView task={task} />;
    case 'parsons':
      return <PublishedParsonsView task={task} />;
    case 'quiz':
      return <PublishedQuizView task={task} />;
    case 'predict':
      return <PublishedPredictView task={task} />;
    case 'fix':
      return <PublishedFixView task={task} />;
    case 'fill':
      return <PublishedFillView task={task} />;
    default:
      return null;
  }
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id } = await params;
  const task = await getTaskForAuthoring(id);
  if (!task || !AUTHORABLE_TYPES.includes(task.type as (typeof AUTHORABLE_TYPES)[number])) {
    notFound();
  }
  const { payload } = task;
  if (payload === null) {
    notFound();
  }

  const mode = authoringModeOf(task);
  const content = editableContent(task);
  // A draft has no live content above it; a revision keeps the live title
  // and badges up here, and the editor below holds the new ones.
  const heading =
    mode === 'draft'
      ? t('authoring.editTaskTitle')
      : mode === 'revision'
        ? t('authoring.editRevisionTitle')
        : t('authoring.viewTaskTitle');

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/tasks" className="text-sm text-accent">
        {t('authoring.backToTasks')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{heading}</h1>
      <p className="mt-1 text-ink">{task.title}</p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <TaskTypeChip type={payload.type} />
        <DifficultyMeter difficulty={task.difficulty} />
      </p>

      <TaskTagsEditor taskId={task.id} initialTags={normalizeTags(task.tags)} />

      {mode === 'draft' && content && <TaskEditor id={task.id} content={content} />}

      {mode === 'revision' && content && (
        <RevisionFrame taskId={task.id} liveVersion={task.version}>
          <TaskEditor id={task.id} content={content} initialReferenceCode={task.reference?.code} />
        </RevisionFrame>
      )}

      {mode === 'published' && <StartRevision taskId={task.id} version={task.version} />}
      {mode === 'locked' && revisionBlocker(task) === 'parameterized' && (
        <p className="mt-6 rounded-md border border-line bg-surface p-3 text-sm text-ink-muted">
          {t('authoring.revisionParameterized')}
        </p>
      )}
      {(mode === 'published' || mode === 'locked') && <PublishedView task={task} />}
    </main>
  );
}

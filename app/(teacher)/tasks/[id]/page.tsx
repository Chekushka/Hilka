import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TurtleCanvas } from '@/components/canvas/TurtleCanvas';
import { DraftTaskEditor } from '@/components/authoring/DraftTaskEditor';
import { ParsonsDraftEditor } from '@/components/authoring/ParsonsDraftEditor';
import { QuizDraftEditor } from '@/components/authoring/QuizDraftEditor';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getTaskForAuthoring } from '@/lib/db/task-authoring';
import { t } from '@/lib/i18n';
import type { TaskRow } from '@/lib/db/task-mapping';

export const dynamic = 'force-dynamic';

/** A published (or archived) `code` task cannot be edited here — re-drafting is separate, unbuilt work. */
function PublishedCodeView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'code') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="rounded-md border border-line bg-surface p-3 text-sm text-ink-muted">
        {t('authoring.notEditable')}
      </p>
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <p className="text-ink">{task.payload.prompt}</p>

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
    </div>
  );
}

/** A published `parsons` task — the pool is derived, so this just lists the payload as-is. */
function PublishedParsonsView({ task }: { task: TaskRow }) {
  if (task.payload?.type !== 'parsons') return null;
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="rounded-md border border-line bg-surface p-3 text-sm text-ink-muted">
        {t('authoring.notEditable')}
      </p>
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <p className="text-ink">{task.payload.prompt}</p>

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
      <p className="rounded-md border border-line bg-surface p-3 text-sm text-ink-muted">
        {t('authoring.notEditable')}
      </p>
      <p className="text-sm text-ink-muted">{t('authoring.versionLabel', { version: task.version })}</p>
      <p className="text-ink">{task.payload.prompt}</p>

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

const AUTHORABLE_TYPES = ['code', 'parsons', 'quiz'] as const;

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

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/tasks" className="text-sm text-accent">
        {t('authoring.backToTasks')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">
        {task.status === 'draft' ? t('authoring.editTaskTitle') : t('authoring.viewTaskTitle')}
      </h1>
      <p className="mt-1 text-ink">{task.title}</p>

      {task.status !== 'draft' ? (
        payload.type === 'code' ? (
          <PublishedCodeView task={task} />
        ) : payload.type === 'parsons' ? (
          <PublishedParsonsView task={task} />
        ) : (
          <PublishedQuizView task={task} />
        )
      ) : payload.type === 'code' ? (
        <DraftTaskEditor
          task={{
            id: task.id,
            title: task.title,
            payload,
            checks: task.checks,
            hints: task.hints,
            difficulty: task.difficulty,
            gradeTags: task.gradeTags
          }}
        />
      ) : payload.type === 'parsons' ? (
        <ParsonsDraftEditor
          task={{
            id: task.id,
            title: task.title,
            payload,
            checks: task.checks,
            hints: task.hints,
            difficulty: task.difficulty,
            gradeTags: task.gradeTags
          }}
        />
      ) : (
        <QuizDraftEditor
          task={{
            id: task.id,
            title: task.title,
            payload,
            checks: task.checks,
            hints: task.hints,
            difficulty: task.difficulty,
            gradeTags: task.gradeTags
          }}
        />
      )}
    </main>
  );
}

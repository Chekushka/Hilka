import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TaskWorkspace } from '@/components/task/TaskWorkspace';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getPublishedTaskById } from '@/lib/db/tasks';
import { t } from '@/lib/i18n';
import { isParameterized, resolveTaskParams } from '@/lib/task/params';

export const dynamic = 'force-dynamic';

/**
 * A published task as a student meets it, for a teacher choosing tasks — the
 * session builder's bank and the routes editor link here, in a new tab so the
 * choice in progress stays. The real workspace: Run and Check work, and no
 * attempt is recorded (`onSubmitAttempt` is absent, as in plain practice).
 * A parameterized task shows one example variant; each student gets their own.
 */
const EXAMPLE_SEED = 1;

export default async function TaskPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id } = await params;
  const published = await getPublishedTaskById(id);
  if (!published) {
    notFound();
  }
  const parameterized = isParameterized(published);
  const task = parameterized ? resolveTaskParams(published, EXAMPLE_SEED) : published;

  return (
    <div data-testid="task-preview">
      <TaskWorkspace
        task={task}
        chrome={{
          context: (
            <>
              <span className="font-semibold text-ink">{t('taskPreview.label')}</span>
              <span className="flex-1" />
              <Link href={`/tasks/${id}`} className="text-accent">
                {t('taskPreview.openTask')}
              </Link>
            </>
          ),
          notice: (
            <p className="mx-5 rounded-lg border border-line bg-surface p-3 text-sm text-ink-muted">
              {t('taskPreview.note')}
              {parameterized && ` ${t('taskPreview.variantNote')}`}
            </p>
          )
        }}
      />
    </div>
  );
}

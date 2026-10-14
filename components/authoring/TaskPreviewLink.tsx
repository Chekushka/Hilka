import { t } from '@/lib/i18n';

/**
 * Opens a task as a student sees it (`/tasks/[id]/preview`) in a new tab, so
 * a teacher choosing tasks keeps the choice in progress. Sits inside a bank
 * row's label: a link there follows itself and leaves the checkbox alone.
 */
export function TaskPreviewLink({ id, title }: { id: string; title: string }) {
  return (
    <a
      href={`/tasks/${id}/preview`}
      target="_blank"
      rel="noopener"
      aria-label={t('taskPreview.linkLabel', { title })}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-accent hover:border-accent"
    >
      {t('taskPreview.link')}
    </a>
  );
}

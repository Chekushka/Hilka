'use client';

/**
 * Editing a published task (lib/task/revision.ts). `StartRevision` opens a
 * revision from the live version; `RevisionFrame` wraps the editor while one
 * is open — saying what students see meanwhile, offering to throw the
 * revision away, and taking over once the editor has published it. The
 * editors are the draft ones, unchanged in what they save and publish: they
 * only tell the frame they published, through `useRevisionPublished`.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

const RevisionContext = createContext<(() => void) | null>(null);

/** Called by an editor once its publish succeeded; a no-op outside a revision (a draft). */
export function useRevisionPublished(): () => void {
  return useContext(RevisionContext) ?? noop;
}

function noop() {}

export function StartRevision({ taskId, version }: { taskId: string; version: number }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'starting' | 'error'>('idle');

  async function start() {
    setState('starting');
    const response = await fetch(`/api/tasks/${taskId}/revision`, { method: 'POST' }).catch(() => null);
    if (!response?.ok) {
      setState('error');
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <p className="text-sm text-ink-muted">{t('authoring.revisionStartNote', { version })}</p>
      <button
        type="button"
        onClick={start}
        disabled={state === 'starting'}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm text-surface disabled:opacity-50"
      >
        {state === 'starting' ? t('authoring.revisionStarting') : t('authoring.revisionStart')}
      </button>
      {state === 'error' && <p className="text-sm text-attention">{t('authoring.revisionStartError')}</p>}
    </div>
  );
}

export function RevisionFrame({
  taskId,
  liveVersion,
  children
}: {
  taskId: string;
  liveVersion: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(false);
  const [discard, setDiscard] = useState<'idle' | 'discarding' | 'error'>('idle');

  async function handleDiscard() {
    if (!window.confirm(t('authoring.revisionDiscardConfirm', { version: liveVersion }))) return;
    setDiscard('discarding');
    const response = await fetch(`/api/tasks/${taskId}/revision`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setDiscard('error');
      return;
    }
    router.refresh();
  }

  return (
    <RevisionContext.Provider value={() => setPublished(true)}>
      {published ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t('authoring.revisionPublished')}</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="self-start rounded-md border border-accent px-4 py-2 text-sm text-accent"
          >
            {t('authoring.revisionBackToTask')}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3 rounded-md border-l-4 border-accent bg-surface p-4">
          <p className="text-sm text-ink">{t('authoring.revisionBanner', { version: liveVersion })}</p>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={discard === 'discarding'}
            className="self-start rounded-md border border-line px-4 py-2 text-sm text-ink-muted disabled:opacity-50"
          >
            {discard === 'discarding' ? t('authoring.revisionDiscarding') : t('authoring.revisionDiscard')}
          </button>
          {discard === 'error' && <p className="text-sm text-attention">{t('authoring.revisionDiscardError')}</p>}
        </div>
      )}
      {children}
    </RevisionContext.Provider>
  );
}

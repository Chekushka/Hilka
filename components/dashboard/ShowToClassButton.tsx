'use client';

/**
 * Opens the projector window (/show/[id]): the code as large as the screen
 * allows, the link, and the class race when it is on. A window of its own, so
 * the teacher can drag it to the projector and keep the class table here.
 */
import { t } from '@/lib/i18n';

export function ShowToClassButton({ sessionId }: { sessionId: string }) {
  const href = `/show/${sessionId}`;
  return (
    <a
      href={href}
      target="hilka-show"
      onClick={(event) => {
        const opened = window.open(href, 'hilka-show', 'popup,width=1280,height=800');
        // A blocked popup falls back to the link's own new tab.
        if (opened) event.preventDefault();
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2 text-base font-bold text-surface hover:opacity-90"
      data-testid="show-to-class"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
      {t('dashboard.showToClass')}
    </a>
  );
}

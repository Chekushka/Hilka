'use client';

/**
 * Opens the projector window: the session's code (/show/[id]) or a lesson's
 * theory (/present/[lesson]). One window for both, so the teacher drags it to
 * the projector once and each button changes what it shows, while the class
 * table stays on the teacher's own screen.
 */
import { t } from '@/lib/i18n';

const WINDOW = 'hilka-show';

export function ShowToClassButton({
  href,
  label = t('dashboard.showToClass'),
  quiet = false,
  testId = 'show-to-class'
}: {
  href: string;
  label?: string;
  /** A smaller outlined button, for a row of them or a table cell. */
  quiet?: boolean;
  testId?: string;
}) {
  return (
    <a
      href={href}
      target={WINDOW}
      onClick={(event) => {
        const opened = window.open(href, WINDOW, 'popup,width=1280,height=800');
        // A blocked popup falls back to the link's own new tab.
        if (opened) {
          event.preventDefault();
          opened.focus();
        }
      }}
      className={
        quiet
          ? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border-2 border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent-soft'
          : 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2 text-base font-bold text-surface hover:opacity-90'
      }
      data-testid={testId}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className={quiet ? 'h-4 w-4' : 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
      {label}
    </a>
  );
}

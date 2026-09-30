import type { ReactNode } from 'react';
import { AppHeader, HeaderLink } from '@/components/layout/AppHeader';
import { t } from '@/lib/i18n';

/**
 * Student screens: the shared app bar with one way back to the lessons. No
 * account, no name, no XP up here — the workspace stays a tool, and the
 * garden lives on the lesson list (docs/design-brief-python-platform.md).
 */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader nav={<HeaderLink href="/practice">{t('shell.lessons')}</HeaderLink>} />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

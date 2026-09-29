import type { ReactNode } from 'react';
import { AppHeader, HeaderLink } from '@/components/layout/AppHeader';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { t } from '@/lib/i18n';

/**
 * Teacher screens: the same app bar as the students', with the four places a
 * teacher prepares from. Logged out (the login page), the bar is just the mark
 * — each page still does its own redirect, this only decides what to show.
 */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const teacher = await getCurrentTeacher();
  return (
    <>
      <AppHeader
        nav={
          teacher && (
            <>
              <HeaderLink href="/dashboard">{t('dashboard.title')}</HeaderLink>
              <HeaderLink href="/sessions/new">{t('sessionBuilder.newSession')}</HeaderLink>
              <HeaderLink href="/tasks">{t('authoring.tasksTitle')}</HeaderLink>
              <HeaderLink href="/lessons">{t('lessonForm.listTitle')}</HeaderLink>
            </>
          )
        }
        aside={
          teacher && (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                {t('auth.logout')}
              </button>
            </form>
          )
        }
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

import type { ReactNode } from 'react';
import { AppHeader, HeaderLink } from '@/components/layout/AppHeader';
import { isSuperuser } from '@/lib/auth/current-admin';
import { t } from '@/lib/i18n';

/** The superuser's screens: the shared app bar, with its one page and a way out. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await isSuperuser();
  return (
    <>
      <AppHeader
        nav={admin && <HeaderLink href="/admin">{t('admin.navTeachers')}</HeaderLink>}
        aside={
          admin && (
            <form action="/api/admin/logout" method="post">
              <button type="submit" className="text-sm text-ink-muted hover:text-ink">
                {t('admin.logout')}
              </button>
            </form>
          )
        }
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

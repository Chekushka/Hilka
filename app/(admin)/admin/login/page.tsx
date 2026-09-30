import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { isSuperuser } from '@/lib/auth/current-admin';
import { superuserReadiness } from '@/lib/auth/superuser';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * The superuser's login. When the server is not configured for one (a
 * missing variable — lib/auth/superuser.ts), it says which, instead of a
 * form that could only fail: the names of missing variables, never a value.
 */
export default async function AdminLoginPage() {
  if (await isSuperuser()) {
    redirect('/admin');
  }
  const readiness = superuserReadiness(process.env);
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('admin.loginTitle')}</h1>
      {readiness.ready ? (
        <AdminLoginForm />
      ) : (
        <div role="status" className="mt-4 rounded-lg border border-attention p-4 text-sm text-ink">
          <p className="font-semibold">{t('admin.notConfiguredTitle')}</p>
          <p className="mt-2 text-ink-muted">
            {t(readiness.missing === 'auth_secret' ? 'admin.notConfiguredSecret' : 'admin.notConfiguredSuperuser')}
          </p>
        </div>
      )}
    </main>
  );
}

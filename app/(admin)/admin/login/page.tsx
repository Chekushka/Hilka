import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { isSuperuser } from '@/lib/auth/current-admin';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isSuperuser()) {
    redirect('/admin');
  }
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center p-6">
      <h1 className="text-xl font-semibold text-ink">{t('admin.loginTitle')}</h1>
      <AdminLoginForm />
    </main>
  );
}

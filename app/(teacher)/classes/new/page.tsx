import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClassForm } from '@/components/authoring/ClassForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function NewClassPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.backToDashboard')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('classForm.newTitle')}</h1>
      <ClassForm mode="create" />
    </main>
  );
}

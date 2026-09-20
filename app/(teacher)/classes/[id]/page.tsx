import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ClassForm } from '@/components/authoring/ClassForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getClassWithRosterForTeacher } from '@/lib/db/classes';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id } = await params;
  const klass = await getClassWithRosterForTeacher(id, teacher.id);
  if (!klass) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.backToDashboard')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('classForm.editTitle', { title: klass.title })}</h1>
      <ClassForm mode="edit" classId={klass.id} initialTitle={klass.title} initialRoster={klass.roster} />
    </main>
  );
}

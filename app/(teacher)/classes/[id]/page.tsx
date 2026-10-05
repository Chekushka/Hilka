import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ClassForm } from '@/components/authoring/ClassForm';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import { getClassWithRosterForTeacher, listNamesWithAttempts } from '@/lib/db/classes';
import { isUuid } from '@/lib/lessons/authoring';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    redirect('/login');
  }

  const { id } = await params;
  const klass = isUuid(id) ? await getClassWithRosterForTeacher(id, teacher.id) : null;
  if (!klass) {
    notFound();
  }
  const namesWithResults = await listNamesWithAttempts(klass.id);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm text-accent">
        {t('dashboard.backToDashboard')}
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-ink">{t('classForm.editTitle', { title: klass.title })}</h1>
      <ClassForm
        mode="edit"
        classId={klass.id}
        initialTitle={klass.title}
        initialGrade={klass.grade}
        initialRoster={klass.roster}
        namesWithResults={namesWithResults}
      />
    </main>
  );
}

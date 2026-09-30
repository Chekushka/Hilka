import { redirect } from 'next/navigation';
import { TeacherAccessPanel } from '@/components/admin/TeacherAccessPanel';
import { isSuperuser } from '@/lib/auth/current-admin';
import { formatDate } from '@/lib/dashboard/time';
import { listTeachers } from '@/lib/db/teachers';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Who may log in as a teacher — the superuser's one page. */
export default async function AdminPage() {
  if (!(await isSuperuser())) {
    redirect('/admin/login');
  }
  const teachers = await listTeachers();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">{t('admin.title')}</h1>
      <div className="mt-5">
        <TeacherAccessPanel
          teachers={teachers.map((row) => ({
            id: row.id,
            email: row.email,
            status: row.status,
            date: formatDate(row.createdAt)
          }))}
        />
      </div>
    </main>
  );
}

import { SchoolComputerSwitch } from '@/components/school/SchoolComputerSwitch';
import { t } from '@/lib/i18n';

/**
 * Marks this browser as a school computer (docs/AI_CONTEXT.md, "School
 * Computers"). A teacher opens it once on each classroom PC; the dashboard
 * links here. No login: the mark only makes a browser forget more.
 */
export default function SchoolComputerPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 py-10">
      <h1 className="text-2xl font-bold text-ink">{t('school.title')}</h1>
      <p className="text-ink">{t('school.intro')}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-ink">
        <li>{t('school.pointSession')}</li>
        <li>{t('school.pointIdle')}</li>
        <li>{t('school.pointCode')}</li>
        <li>{t('school.pointFinish')}</li>
        <li>{t('school.pointTeacher')}</li>
      </ul>
      <p className="text-sm text-ink-muted">{t('school.markNote')}</p>
      <SchoolComputerSwitch />
    </main>
  );
}

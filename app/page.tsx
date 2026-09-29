import Link from 'next/link';
import { JoinByCodeForm } from '@/components/entry/JoinByCodeForm';
import { AppHeader } from '@/components/layout/AppHeader';
import { Plant } from '@/components/meta/Plant';
import type { PlantStage } from '@/lib/meta/garden';
import { t } from '@/lib/i18n';

const GARDEN_STAGES: PlantStage[] = [0, 1, 2, 3, 4];

/**
 * The entry page. Two ways in for a student — the teacher's session code in
 * class, the lessons on their own — and a quiet one for the teacher. No
 * account, no email, no password for a student (CLAUDE.md rule 8).
 *
 * Reads nothing from the database, so it still opens when the database does
 * not; whatever is behind each door says for itself whether it is there.
 */
export default function Home() {
  return (
    <>
      <AppHeader
        aside={
          <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
            {t('home.teacherLink')}
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('home.title')}</h1>
          <p className="mt-2 max-w-xl text-lg text-ink-muted">{t('home.subtitle')}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section aria-labelledby="join-title" className="flex flex-col rounded-xl border border-line bg-surface p-6 sm:p-8">
            <h2 id="join-title" className="text-xl font-semibold text-ink">
              {t('home.joinTitle')}
            </h2>
            <p className="mt-1 text-ink-muted">{t('home.joinNote')}</p>
            <div className="mt-6">
              <JoinByCodeForm autoFocus />
            </div>
            <span className="flex-1" />
            <ol className="mt-8 flex flex-col gap-2 border-t border-line pt-5 text-sm text-ink-muted sm:flex-row sm:gap-6">
              {(['home.stepCode', 'home.stepName', 'home.stepWork'] as const).map((key, index) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                    {index + 1}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="practice-title" className="flex flex-col rounded-xl border border-line bg-surface p-6 sm:p-8">
            <h2 id="practice-title" className="text-xl font-semibold text-ink">
              {t('home.practiceTitle')}
            </h2>
            <p className="mt-1 text-ink-muted">{t('home.practiceNote')}</p>
            {/* The garden, seed to flower — the reward layer, shown here as a promise
                rather than on the workspace. Decorative; the sentence below says it. */}
            <div className="mt-6 flex items-end justify-between gap-2 rounded-lg bg-bg px-4 pt-3" aria-hidden="true">
              {GARDEN_STAGES.map((stage) => (
                <Plant key={stage} stage={stage} size={40} />
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-muted">{t('home.gardenNote')}</p>
            <span className="flex-1" />
            <Link
              href="/practice"
              className="mt-6 w-fit rounded-lg border-2 border-accent px-5 py-2.5 font-semibold text-accent hover:bg-accent-soft"
            >
              {t('home.practiceLink')}
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}

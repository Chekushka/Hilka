'use client';

/** The /school page's switch: marks this browser as a school computer, or takes the mark off (lib/device/school.ts). */
import { useSyncExternalStore } from 'react';
import { setSchoolComputer, useSchoolComputer } from '@/lib/device/school-client';
import { t } from '@/lib/i18n';

const noSubscription = () => () => {};

export function SchoolComputerSwitch() {
  const school = useSchoolComputer();
  // The mark lives in the browser: say nothing about it until it has been read.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  if (!hydrated) return null;

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink" data-testid="school-state">
        {school ? t('school.stateOn') : t('school.stateOff')}
      </p>
      <button
        type="button"
        onClick={() => setSchoolComputer(!school)}
        className={
          school
            ? 'rounded-lg border border-line px-4 py-2 text-ink'
            : 'rounded-lg bg-accent px-4 py-2 font-semibold text-surface'
        }
      >
        {school ? t('school.turnOff') : t('school.turnOn')}
      </button>
      {!school && <p className="text-sm text-ink-muted">{t('school.turnOnNote')}</p>}
    </div>
  );
}

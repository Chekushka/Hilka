/**
 * The wait while Skulpt loads — several seconds on a classroom machine.
 * Without it the student sees a dead button and presses F5. The mark's two
 * forks light up in turn (docs/mockups, the brand screen): the same mark, no separate
 * spinner, and the words say it too.
 */
import { BrandMark } from '@/components/brand/BrandMark';
import { t } from '@/lib/i18n';

export function EngineLoading() {
  return (
    <span className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <BrandMark size={20} className="stroke-accent" loading />
      <span>
        {t('workspace.loadingEngine')} <span className="text-xs">{t('workspace.loadingHint')}</span>
      </span>
    </span>
  );
}

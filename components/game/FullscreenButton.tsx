'use client';

/** Puts the projector window into full screen, and back. */
import { useState } from 'react';
import { t } from '@/lib/i18n';

export function FullscreenButton() {
  const [full, setFull] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        if (document.fullscreenElement) {
          void document.exitFullscreen().then(() => setFull(false));
        } else {
          void document.documentElement.requestFullscreen?.().then(() => setFull(true));
        }
      }}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
    >
      {full ? t('show.exitFullscreen') : t('show.fullscreen')}
    </button>
  );
}

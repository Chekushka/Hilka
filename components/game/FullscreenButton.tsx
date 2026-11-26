'use client';

/** Puts the projector window into full screen, and back. */
import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

export function FullscreenButton() {
  const [full, setFull] = useState(false);
  // Esc and the F key leave or enter full screen without this button: follow the document, not the clicks.
  useEffect(() => {
    const update = () => setFull(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
    >
      {full ? t('show.exitFullscreen') : t('show.fullscreen')}
    </button>
  );
}

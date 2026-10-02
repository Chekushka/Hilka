'use client';

/**
 * Light / dark switch in the app bar. One press flips what is on screen and
 * remembers it in this browser (lib/theme-client.ts); before anyone presses it, the
 * system's own setting decides. Two states, not three: a "follow the system"
 * option is one more thing to explain to a twelve-year-old, and clearing site
 * data gets it back.
 *
 * The icon shows where a press leads (a moon in the light theme), and the
 * label says it in words.
 */
import { setTheme, useTheme } from '@/lib/theme-client';
import { t } from '@/lib/i18n';

function Moon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      <path
        d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sun() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none">
      <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useTheme();
  // The server cannot know the theme; until hydration, hold the space so nothing shifts.
  if (theme === null) {
    return <span aria-hidden="true" className="h-9 w-9 flex-none" />;
  }
  const dark = theme === 'dark';
  const label = dark ? t('shell.themeToLight') : t('shell.themeToDark');
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-ink-muted hover:bg-shell hover:text-ink"
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

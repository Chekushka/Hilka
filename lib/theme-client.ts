/**
 * The browser side of lib/theme.ts: reading what is on screen, switching it,
 * and a hook that re-renders when it changes. Client components only.
 */
import { useSyncExternalStore } from 'react';
import { parseTheme, resolveTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type Theme } from './theme';

const SYSTEM_DARK = '(prefers-color-scheme: dark)';

function currentTheme(): Theme {
  return resolveTheme(
    parseTheme(document.documentElement.getAttribute('data-theme')),
    window.matchMedia(SYSTEM_DARK).matches
  );
}

/** Switches the whole page at once and remembers the choice. Storage may be blocked; the switch still happens. */
export function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private window or blocked storage: this page still switches, the next one starts from the system.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(SYSTEM_DARK);
  // Another tab switched: follow it, so two open tabs never disagree.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const theme = parseTheme(event.newValue);
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
    onChange();
  };
  media.addEventListener('change', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The theme on screen, re-rendering when it changes — for the toggle, and for
 * anything that resolves tokens into pixels once (TurtleCanvas) and so has to
 * draw again. `null` on the server and during hydration: the server cannot know.
 */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, currentTheme, () => null);
}

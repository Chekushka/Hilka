/**
 * Light or dark, chosen by the student or teacher and remembered in this
 * browser. Until someone chooses, the operating system decides
 * (`prefers-color-scheme`), as it always did. A choice is written to
 * `<html data-theme>`, which app/globals.css reads; nothing else changes —
 * every colour already comes from the tokens.
 *
 * Kept in localStorage only: a display preference is not progress, and it is
 * not worth a progress code or a row.
 *
 * This module is pure, so the root layout (a server component) can inline the
 * script; the browser side is lib/theme-client.ts.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hilka-theme';
export const THEME_CHANGE_EVENT = 'hilka-theme-change';

/** A stored value, if it is one this code wrote. Anything else means "not chosen". */
export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** The theme on screen: the explicit choice, else what the system asks for. */
export function resolveTheme(chosen: Theme | null, systemDark: boolean): Theme {
  return chosen ?? (systemDark ? 'dark' : 'light');
}

/**
 * Runs in `<head>` before the first paint (app/layout.tsx), so a page never
 * flashes light before turning dark. Plain ES5 and self-contained: it is
 * inlined as text, not bundled.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTheme, resolveTheme, themeInitScript, THEME_STORAGE_KEY } from './theme';

describe('parseTheme', () => {
  it('accepts only the two values the toggle writes', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('Dark')).toBeNull();
    expect(parseTheme('system')).toBeNull();
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('follows the system until someone chooses', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('lets a choice win over the system either way', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('themeInitScript', () => {
  it('reads the same key the toggle writes', () => {
    expect(themeInitScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});

/*
 * CSS has no way to say "these variables, under either selector", so the dark
 * palette is written twice in app/globals.css: once for a system in dark mode
 * with no choice made, once for an explicit choice. The two must never drift.
 */
describe('app/globals.css', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

  function block(selector: string): string {
    const start = css.indexOf(selector);
    expect(start, `${selector} is missing`).toBeGreaterThanOrEqual(0);
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css
      .slice(open + 1, close)
      .split('\n')
      .map((line) => line.replace(/\/\*.*?\*\//g, '').trim())
      .filter(Boolean)
      .join('\n');
  }

  it('defines the same dark palette for the system preference and for an explicit choice', () => {
    const system = block(":root:not([data-theme='light'])");
    const chosen = block(":root[data-theme='dark']");
    expect(system).toContain('--bg:');
    expect(system).toBe(chosen);
  });
});

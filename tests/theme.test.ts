import { describe, it, expect } from 'vitest';
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  coerceTheme,
  themeClass,
  themeBootScript,
} from '../src/site/theme';

describe('themes', () => {
  it('offers jewel, twilight, and soft, defaulting to jewel', () => {
    expect(THEMES).toEqual(['jewel', 'twilight', 'soft']);
    expect(DEFAULT_THEME).toBe('jewel');
  });

  it('coerces stored values to a valid theme', () => {
    expect(coerceTheme('twilight')).toBe('twilight');
    expect(coerceTheme('soft')).toBe('soft');
    expect(coerceTheme('mid-century')).toBe('jewel');
    expect(coerceTheme(null)).toBe('jewel');
    expect(coerceTheme(undefined)).toBe('jewel');
  });

  it('names the html theme class', () => {
    expect(themeClass('jewel')).toBe('theme-jewel');
    expect(themeClass('soft')).toBe('theme-soft');
  });

  it('generates a boot script targeting documentElement with the storage key and every theme', () => {
    const script = themeBootScript();
    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain('documentElement');
    for (const theme of THEMES) {
      expect(script).toContain(theme);
    }
    expect(script).not.toContain('{{');
  });
});

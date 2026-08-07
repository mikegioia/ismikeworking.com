import { describe, it, expect } from 'vitest';
import { THEMES, DEFAULT_THEME, coerceTheme, bodyClass } from '../src/site/theme';

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

  it('composes the body class from theme and level', () => {
    expect(bodyClass('jewel', 6)).toBe('theme-jewel level-6');
    expect(bodyClass('soft', 1)).toBe('theme-soft level-1');
  });
});

export const THEMES = ['jewel', 'twilight', 'soft'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'jewel';

/** Coerce a stored (possibly stale or tampered) value to a valid theme. */
export function coerceTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

export function bodyClass(theme: Theme, level: number): string {
  return `theme-${theme} level-${level}`;
}

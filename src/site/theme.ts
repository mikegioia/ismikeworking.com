export const THEMES = ['jewel', 'twilight', 'soft'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'jewel';

export const THEME_STORAGE_KEY = 'imw-theme';

/**
 * Inline script injected at the top of <body> so a stored theme applies
 * during HTML parsing, before first paint — no flash of the default theme.
 * The prerendered body class is always theme-<DEFAULT_THEME>, so only a
 * stored non-default theme needs the swap.
 */
export function themeBootScript(): string {
  return (
    '(function(){try{' +
    `var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(${JSON.stringify(THEMES)}.indexOf(t)>0){` +
    `document.body.className=document.body.className.replace(/theme-[a-z]+/,'theme-'+t);` +
    '}}catch(e){}})();'
  );
}

/** Coerce a stored (possibly stale or tampered) value to a valid theme. */
export function coerceTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

export function bodyClass(theme: Theme, level: number): string {
  return `theme-${theme} level-${level}`;
}

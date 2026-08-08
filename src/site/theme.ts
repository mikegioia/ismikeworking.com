export const THEMES = ['jewel', 'twilight', 'soft'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'jewel';

export const THEME_STORAGE_KEY = 'imw-theme';

export function themeClass(theme: Theme): string {
  return `theme-${theme}`;
}

/**
 * Inline script injected in <head> so a stored theme lands on <html>
 * while the document is still parsing — before the body exists and
 * before anything can possibly paint. The prerendered <html> class is
 * always theme-<DEFAULT_THEME>, so only a stored non-default theme
 * needs the swap.
 */
export function themeBootScript(): string {
  return (
    '(function(){try{' +
    `var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
    `if(${JSON.stringify(THEMES)}.indexOf(t)>0){` +
    `var d=document.documentElement;` +
    `d.className=d.className.replace(/theme-[a-z]+/,'theme-'+t);` +
    '}}catch(e){}})();'
  );
}

/** Coerce a stored (possibly stale or tampered) value to a valid theme. */
export function coerceTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}


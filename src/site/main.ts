import brief from '../../data/daybrief.json';
import { assess } from '../engine/evaluate';
import { breakdownHtml } from './breakdown';
import { nyDateString } from '../lib/time';
import { bodyClass, coerceTheme, THEME_STORAGE_KEY, type Theme } from './theme';
import type { Assessment, DayBrief } from '../engine/types';

const dayBrief = brief as unknown as DayBrief;

const STALE: Assessment = {
  verdict: { text: 'Probably', level: 2 },
  score: 0,
  headline: 'The data robot overslept — Mike is probably working.',
  signals: [],
};

function loadTheme(): Theme {
  try {
    return coerceTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return coerceTheme(null);
  }
}

let theme = loadTheme();

function setTheme(next: Theme): void {
  theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private browsing or blocked storage — the choice just won't persist.
  }
  render();
}

function currentAssessment(): Assessment {
  const now = Date.now();
  return nyDateString(now) === dayBrief.date ? assess(dayBrief, now) : STALE;
}

function render(): void {
  const a = currentAssessment();
  document.body.className = bodyClass(theme, a.verdict.level);
  document.getElementById('verdict')!.textContent = a.verdict.text;
  document.getElementById('reason')!.textContent = a.headline;
  document.getElementById('breakdown')!.innerHTML = breakdownHtml(a);
  document.getElementById('updated')!.textContent =
    'as of ' +
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
  document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });
}

document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
  button.addEventListener('click', () => setTheme(coerceTheme(button.dataset.theme)));
});

render();
setInterval(render, 60_000);

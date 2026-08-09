import brief from '../../data/daybrief.json';
import { coerceTheme, themeClass, THEME_STORAGE_KEY, type Theme } from './theme';
import { staleHint } from './stale';
import {
  calendarHtml, dayDetailHtml, monthKey, monthLabel, shiftMonth,
} from './calendar';
import { parseHistory, type HistoryFile } from '../lib/history';
import { nyDateString } from '../lib/time';
import type { DayBrief } from '../engine/types';

const dayBrief = brief as unknown as DayBrief;

// --- Theme -----------------------------------------------------------------

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
  applyTheme();
}

function applyTheme(): void {
  const html = document.documentElement;
  const ready = html.classList.contains('ready');
  html.className = themeClass(theme) + (ready ? ' ready' : '');
  document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });
}

document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
  button.addEventListener('click', () => setTheme(coerceTheme(button.dataset.theme)));
});

applyTheme();

// --- Stale hint ------------------------------------------------------------

const hintEl = document.getElementById('stale-hint') as HTMLElement;
function updateHint(): void {
  const hint = staleHint(dayBrief.date, Date.now());
  hintEl.textContent = hint ?? '';
  hintEl.hidden = hint === null;
}
updateHint();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateHint();
});

// --- History calendar ------------------------------------------------------

const section = document.getElementById('history') as HTMLElement;
const toggleBtn = document.getElementById('history-toggle') as HTMLButtonElement;
const titleEl = document.getElementById('cal-title') as HTMLElement;
const gridEl = document.getElementById('cal-grid') as HTMLElement;
const detailEl = document.getElementById('cal-detail') as HTMLElement;
const prevBtn = document.getElementById('cal-prev') as HTMLButtonElement;
const nextBtn = document.getElementById('cal-next') as HTMLButtonElement;

let history: HistoryFile | null = null;
let selected: string | null = null;
// Today's verdict level, baked into the page at build time — restored when no
// past day is selected.
const todayBodyClass = document.body.className;
const today = () => nyDateString(Date.now());
let view = { year: Number(today().slice(0, 4)), month: Number(today().slice(5, 7)) };

function viewKey(): string {
  return `${view.year}-${String(view.month).padStart(2, '0')}`;
}

function renderCalendar(): void {
  if (!history) return;
  const dates = Object.keys(history.days).sort();
  const earliest = dates.length ? monthKey(dates[0]) : monthKey(today());
  const latest = monthKey(today());
  titleEl.textContent = monthLabel(view.year, view.month);
  gridEl.innerHTML = calendarHtml(history.days, view.year, view.month, selected);
  prevBtn.disabled = viewKey() <= earliest;
  nextBtn.disabled = viewKey() >= latest;
  const entry = selected ? history.days[selected] : undefined;
  detailEl.innerHTML =
    selected && entry
      ? `<div class="cal-detail-panel">${dayDetailHtml(selected, entry)}</div>`
      : '';
  document.body.className = entry ? `level-${entry.verdict.level}` : todayBodyClass;
}

async function openHistory(): Promise<void> {
  if (!history) {
    try {
      const res = await fetch('/assets/history.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      history = parseHistory(await res.text());
    } catch {
      gridEl.innerHTML = '<p class="math">history unavailable</p>';
      return;
    }
  }
  renderCalendar();
}

toggleBtn.addEventListener('click', () => {
  const opening = section.hidden;
  section.hidden = !opening;
  toggleBtn.setAttribute('aria-expanded', String(opening));
  if (opening) {
    void openHistory();
  } else {
    selected = null;
    if (history) renderCalendar();
  }
});

prevBtn.addEventListener('click', () => {
  view = shiftMonth(view.year, view.month, -1);
  renderCalendar();
});

nextBtn.addEventListener('click', () => {
  view = shiftMonth(view.year, view.month, 1);
  renderCalendar();
});

gridEl.addEventListener('click', (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cal-day');
  if (!cell?.dataset.date) return;
  selected = selected === cell.dataset.date ? null : cell.dataset.date;
  renderCalendar();
});

// Arm the crossfade only after the first frame has painted, so theme and
// verdict colors can never animate in during page load.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
});

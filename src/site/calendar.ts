import type { HistoryEntry } from '../lib/history';
import { breakdownHtml, escapeHtml } from './breakdown';

/** Monday-first weeks for a month; null cells pad the edges. month is 1-12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const mm = String(month).padStart(2, '0');
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const m = month - 1 + delta;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function calendarHtml(
  days: Record<string, HistoryEntry>,
  year: number,
  month: number,
  selected: string | null
): string {
  const head = DOW.map((d) => `<span class="cal-dow">${d}</span>`).join('');
  const cells = monthGrid(year, month)
    .flat()
    .map((date) => {
      if (!date) return '<span class="cal-cell cal-empty"></span>';
      const day = Number(date.slice(8));
      const entry = days[date];
      if (!entry) return `<span class="cal-cell cal-blank">${day}</span>`;
      const sel = date === selected ? ' cal-selected' : '';
      return (
        `<button class="cal-cell cal-day lvl-${entry.verdict.level}${sel}" ` +
        `data-date="${date}" title="${escapeHtml(entry.verdict.text)}">${day}</button>`
      );
    })
    .join('');
  return `<div class="cal-grid">${head}${cells}</div>`;
}

export function dayDetailHtml(date: string, entry: HistoryEntry): string {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', dateStyle: 'full',
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    `<h2>${escapeHtml(label)} — ${escapeHtml(entry.verdict.text)}</h2>` +
    `<p class="reason">${escapeHtml(entry.headline)}</p>` +
    breakdownHtml(entry, { numberFirst: true })
  );
}

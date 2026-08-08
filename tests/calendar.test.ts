import { describe, it, expect } from 'vitest';
import {
  monthGrid, monthLabel, shiftMonth, monthKey, calendarHtml, dayDetailHtml,
} from '../src/site/calendar';
import type { HistoryEntry } from '../src/lib/history';

const entry: HistoryEntry = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    { id: 'weekend-baseline', label: 'Weekend', contribution: 10, reason: 'w' },
  ],
};

describe('monthGrid', () => {
  it('lays out August 2026 Monday-first (Aug 1 2026 is a Saturday)', () => {
    const weeks = monthGrid(2026, 8);
    expect(weeks[0]).toEqual([null, null, null, null, null, '2026-08-01', '2026-08-02']);
    expect(weeks.at(-1)).toEqual(['2026-08-31', null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('handles a month starting on Monday with no leading padding', () => {
    // June 1 2026 is a Monday.
    expect(monthGrid(2026, 6)[0][0]).toBe('2026-06-01');
  });

  it('lays out the DST-transition month correctly (Nov 2026, 30 days)', () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    // Nov 1 2026 is a Sunday — last cell of the first week.
    expect(weeks[0][6]).toBe('2026-11-01');
  });

  it('every week has exactly 7 cells', () => {
    for (const m of [1, 2, 6, 8, 11, 12]) {
      for (const week of monthGrid(2026, m)) expect(week).toHaveLength(7);
    }
  });
});

describe('month navigation helpers', () => {
  it('labels a month', () => {
    expect(monthLabel(2026, 8)).toBe('August 2026');
  });

  it('shifts across year boundaries both ways', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('extracts a month key from a date', () => {
    expect(monthKey('2026-08-08')).toBe('2026-08');
  });
});

describe('calendarHtml', () => {
  const days = { '2026-08-08': entry };

  it('renders logged days as level-tinted buttons with a data-date', () => {
    const html = calendarHtml(days, 2026, 8, null);
    expect(html).toContain('data-date="2026-08-08"');
    expect(html).toContain('lvl-4');
  });

  it('renders unlogged days as inert cells and marks the selected day', () => {
    const html = calendarHtml(days, 2026, 8, '2026-08-08');
    expect(html).toContain('cal-selected');
    expect(html).toContain('<span class="cal-cell cal-blank">7</span>');
    expect(html).not.toContain('data-date="2026-08-07"');
  });
});

describe('dayDetailHtml', () => {
  it('shows the date, verdict, headline, and breakdown', () => {
    const html = dayDetailHtml('2026-08-08', entry);
    expect(html).toContain('Saturday, August 8, 2026');
    expect(html).toContain('No');
    expect(html).toContain('anything can happen');
    expect(html).toContain('Weekend');
  });
});

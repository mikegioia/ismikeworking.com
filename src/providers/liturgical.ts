import type { LiturgicalDay } from '../engine/types';

/** Anonymous Gregorian computus. */
export function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const FIXED: Record<string, LiturgicalDay> = {
  '08-15': { name: 'Assumption of Mary', dayOff: true },
  '11-01': { name: "All Saints' Day", dayOff: true },
  '12-08': { name: 'Immaculate Conception', dayOff: true },
  '12-25': { name: 'Christmas', dayOff: true },
};

export function liturgicalDay(date: string): LiturgicalDay | null {
  const fixed = FIXED[date.slice(5)];
  if (fixed) return fixed;

  const easter = easterDate(Number(date.slice(0, 4)));
  const relative: Array<[number, LiturgicalDay]> = [
    [-46, { name: 'Ash Wednesday', dayOff: false }],
    [-3, { name: 'Holy Thursday', dayOff: true }],
    [-2, { name: 'Good Friday', dayOff: true }],
    [0, {
      name: 'Easter Sunday',
      dayOff: true,
      familyDay: {
        weight: -60,
        reason: 'Mike loves to celebrate Easter (and eat Easter bread) with his family!',
      },
    }],
    [1, { name: 'Easter Monday', dayOff: true }],
  ];

  for (const [offset, day] of relative) {
    if (addDays(easter, offset) === date) return day;
  }
  return null;
}

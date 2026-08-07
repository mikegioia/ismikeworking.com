import { describe, it, expect } from 'vitest';
import { easterDate, liturgicalDay } from '../src/providers/liturgical';
import { liturgicalRule } from '../src/engine/rules/liturgical';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

describe('easterDate', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
  ])('computes Easter %i as %s', (year, date) => {
    expect(easterDate(year)).toBe(date);
  });
});

describe('liturgicalDay', () => {
  it('finds fixed holy days of obligation', () => {
    expect(liturgicalDay('2026-11-01')).toMatchObject({ name: "All Saints' Day", dayOff: true });
    expect(liturgicalDay('2026-12-08')).toMatchObject({ dayOff: true });
  });

  it('finds Easter-relative days for 2026 (Easter = Apr 5)', () => {
    expect(liturgicalDay('2026-04-03')).toMatchObject({ name: 'Good Friday', dayOff: true });
    expect(liturgicalDay('2026-04-02')).toMatchObject({ name: 'Holy Thursday', dayOff: true });
    expect(liturgicalDay('2026-04-06')).toMatchObject({ name: 'Easter Monday', dayOff: true });
    expect(liturgicalDay('2026-02-18')).toMatchObject({ name: 'Ash Wednesday', dayOff: false });
    expect(liturgicalDay('2026-04-05')?.familyDay?.weight).toBe(-60);
  });

  it('returns null on ordinary days', () => {
    expect(liturgicalDay('2026-08-07')).toBeNull();
  });
});

describe('liturgicalRule', () => {
  it('holy day during school term on a weekday = strong yes', () => {
    // 2026-12-08 is a Tuesday inside the school term
    const brief = makeBrief('2026-12-08', {
      inSchoolTerm: true,
      liturgical: liturgicalDay('2026-12-08'),
    });
    const a = combine(liturgicalRule(brief), nyTimeToMs('2026-12-08', 11, 0));
    expect(a.score).toBe(60);
    expect(a.headline).toContain('day off from teaching');
  });

  it('holy day outside school term emits nothing', () => {
    // 2026-08-15 Assumption falls in summer (a Saturday, and out of term)
    const brief = makeBrief('2026-08-15', { liturgical: liturgicalDay('2026-08-15') });
    expect(liturgicalRule(brief)).toHaveLength(0);
  });

  it('Easter Sunday is a family day regardless of term', () => {
    const brief = makeBrief('2026-04-05', { liturgical: liturgicalDay('2026-04-05') });
    const a = combine(liturgicalRule(brief), nyTimeToMs('2026-04-05', 12, 0));
    expect(a.score).toBe(-60);
    expect(a.headline).toContain('Easter');
  });
});

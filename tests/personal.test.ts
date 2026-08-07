import { describe, it, expect } from 'vitest';
import cal from '../calendar/personal.json';
import { holidayFor, inSchoolTerm, type PersonalCalendar } from '../src/providers/personal';
import { personalRule } from '../src/engine/rules/personal';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

const calendar = cal as unknown as PersonalCalendar;

describe('personal provider', () => {
  it('finds a fixed holiday by MM-DD', () => {
    const h = holidayFor(calendar, '2026-08-20');
    expect(h?.title).toBe("Mike's Birthday");
    expect(h?.hardOverride).toBe('NO WAY');
  });

  it('returns null on a plain day', () => {
    expect(holidayFor(calendar, '2026-08-07')).toBeNull();
  });

  it('school term includes a term weekday and excludes vacations and summer', () => {
    expect(inSchoolTerm(calendar, '2026-03-10')).toBe(true);
    expect(inSchoolTerm(calendar, '2025-12-26')).toBe(false); // Christmas break
    expect(inSchoolTerm(calendar, '2026-07-15')).toBe(false); // summer
    expect(inSchoolTerm(calendar, '2026-06-12')).toBe(true);  // inclusive end
  });
});

describe('personalRule', () => {
  it("Mike's birthday pins NO WAY all day", () => {
    const brief = makeBrief('2026-08-20', {
      personal: holidayFor(calendar, '2026-08-20'),
    });
    const a = combine(personalRule(brief), nyTimeToMs('2026-08-20', 14, 0));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('birthday');
  });

  it('Christmas leans positive', () => {
    const brief = makeBrief('2026-12-25', {
      personal: holidayFor(calendar, '2026-12-25'),
    });
    const a = combine(personalRule(brief), nyTimeToMs('2026-12-25', 14, 0));
    expect(a.score).toBe(25);
  });

  it('emits nothing on a plain day', () => {
    expect(personalRule(makeBrief('2026-08-07'))).toHaveLength(0);
  });
});

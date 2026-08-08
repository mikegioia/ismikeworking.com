import { describe, it, expect } from 'vitest';
import { baselineRule } from '../src/engine/rules/baseline';
import { schoolRule } from '../src/engine/rules/school';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

describe('baselineRule', () => {
  it('non-school weekday daytime is a full Yes: project day + weekday bonus', () => {
    const brief = makeBrief('2026-08-07');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 14, 0));
    expect(a.score).toBe(55);
    expect(a.signals.map((s) => s.id)).toEqual(['no-school-project-day', 'weekday']);
    expect(a.verdict.text).toBe('Yes.');
  });

  it('summer weekdays get the summer copy', () => {
    const brief = makeBrief('2026-08-07'); // August, out of term
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 14, 0));
    const projectDay = a.signals.find((s) => s.id === 'no-school-project-day')!;
    expect(projectDay.label).toBe('Summer break');
    expect(projectDay.reason).toBe('Summer weekday — a full project day at the desk.');
  });

  it('non-summer no-school weekdays keep the no-school copy', () => {
    // Christmas break: not in term, but December is not summer
    const brief = makeBrief('2025-12-29');
    const a = combine(baselineRule(brief), nyTimeToMs('2025-12-29', 14, 0));
    const projectDay = a.signals.find((s) => s.id === 'no-school-project-day')!;
    expect(projectDay.label).toBe('No school today');
    expect(projectDay.reason).toBe('No school today — a full project day at the desk.');
  });

  it('weekend daytime is a weak yes', () => {
    const brief = makeBrief('2026-08-08');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-08', 14, 0));
    expect(a.score).toBe(10);
  });

  it('emits no time-of-day signals: nothing fires outside the daytime window', () => {
    const brief = makeBrief('2026-08-08');
    expect(combine(baselineRule(brief), nyTimeToMs('2026-08-08', 3, 0)).signals).toHaveLength(0);
    expect(combine(baselineRule(brief), nyTimeToMs('2026-08-08', 23, 30)).signals).toHaveLength(0);
  });

  it('emits nothing extra on a school day daytime', () => {
    const brief = makeBrief('2026-03-10', { inSchoolTerm: true, schoolDay: true });
    const a = combine(baselineRule(brief), nyTimeToMs('2026-03-10', 14, 0));
    expect(a.signals).toHaveLength(0);
  });
});

describe('schoolRule', () => {
  const brief = makeBrief('2026-03-10', { inSchoolTerm: true, schoolDay: true }); // a Tuesday

  it('teaching hours are a hard no-ish', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 10, 0));
    expect(a.score).toBe(-80);
    expect(a.verdict.text).toBe('NO WAY');
  });

  it('emits only the teaching signal — no evening signal', () => {
    expect(schoolRule(brief).map((s) => s.id)).toEqual(['teaching']);
  });

  it('emits nothing when not a school day', () => {
    expect(schoolRule(makeBrief('2026-08-07'))).toHaveLength(0);
  });
});

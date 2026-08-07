import { describe, it, expect } from 'vitest';
import { baselineRule } from '../src/engine/rules/baseline';
import { schoolRule } from '../src/engine/rules/school';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

describe('baselineRule', () => {
  it('non-school weekday daytime is a project day', () => {
    const brief = makeBrief('2026-08-07');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 14, 0));
    expect(a.score).toBe(35);
    expect(a.signals.map((s) => s.id)).toEqual(['no-school-project-day']);
  });

  it('weekend daytime is a weak yes', () => {
    const brief = makeBrief('2026-08-08');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-08', 14, 0));
    expect(a.score).toBe(10);
  });

  it('late night goes negative', () => {
    const brief = makeBrief('2026-08-07');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 23, 30));
    expect(a.signals.map((s) => s.id)).toEqual(['late-night']);
    expect(a.score).toBe(-40);
  });

  it('early morning goes negative', () => {
    const brief = makeBrief('2026-08-08');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-08', 3, 0));
    expect(a.signals.map((s) => s.id)).toEqual(['early-morning']);
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

  it('school evening is prime project time', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 19, 0));
    expect(a.score).toBe(40);
  });

  it('the gap between school and evening emits nothing', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 16, 0));
    expect(a.signals).toHaveLength(0);
  });

  it('emits nothing when not a school day', () => {
    expect(schoolRule(makeBrief('2026-08-07'))).toHaveLength(0);
  });
});

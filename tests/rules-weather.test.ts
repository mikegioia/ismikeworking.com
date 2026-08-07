import { describe, it, expect } from 'vitest';
import { weatherRule } from '../src/engine/rules/weather';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

const SAT = '2026-08-08';

describe('weatherRule', () => {
  it('nice weekend weather pulls Mike outside', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 74, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 14, 0));
    expect(a.score).toBe(-30);
    expect(a.headline).toContain('74');
  });

  it('rainy weekend is coding weather', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 70, precipProb: 80 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 14, 0));
    expect(a.score).toBe(35);
  });

  it('freezing weekend is coding weather', () => {
    const brief = makeBrief('2026-01-17', { weather: { date: '2026-01-17', highF: 30, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs('2026-01-17', 14, 0));
    expect(a.score).toBe(35);
  });

  it('in-between weather emits nothing', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 55, precipProb: 50 } });
    expect(weatherRule(brief)).toHaveLength(0);
  });

  it('does not fire during a school day even with nice weather', () => {
    const brief = makeBrief('2026-03-10', {
      inSchoolTerm: true,
      schoolDay: true,
      weather: { date: '2026-03-10', highF: 75, precipProb: 5 },
    });
    expect(weatherRule(brief)).toHaveLength(0);
  });

  it('window closes at 7pm', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 74, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 20, 0));
    expect(a.signals).toHaveLength(0);
  });

  it('emits nothing without weather data', () => {
    expect(weatherRule(makeBrief(SAT))).toHaveLength(0);
  });
});

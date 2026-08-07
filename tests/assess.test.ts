import { describe, it, expect } from 'vitest';
import { assess } from '../src/engine/evaluate';
import { nyTimeToMs } from '../src/lib/time';
import { liturgicalDay } from '../src/providers/liturgical';
import { makeBrief } from './helpers';
import type { Match } from '../src/engine/types';

function lfcMatch(date: string, hour: number): Match {
  return {
    competition: 'PL',
    home: 'Liverpool',
    away: 'Everton',
    kickoffMs: nyTimeToMs(date, hour, 0),
    round: '5',
    isFinal: false,
    isKnockout: false,
  };
}

describe('assess — full-engine scenarios', () => {
  it('Liverpool matchday: NO WAY at kickoff, negative-but-softer at 9pm', () => {
    const D = '2026-08-08'; // Saturday
    const brief = makeBrief(D, { matches: [lfcMatch(D, 12)] });
    expect(assess(brief, nyTimeToMs(D, 12, 15)).verdict.text).toBe('NO WAY');
    const evening = assess(brief, nyTimeToMs(D, 21, 0));
    expect(evening.verdict.level).toBeGreaterThanOrEqual(4); // still No-ish
    expect(evening.verdict.text).not.toBe('NO WAY');
  });

  it('holy day on a school-term Tuesday: strong Yes at 11am', () => {
    const D = '2026-12-08'; // Immaculate Conception, a Tuesday
    const brief = makeBrief(D, { inSchoolTerm: true, liturgical: liturgicalDay(D) });
    const a = assess(brief, nyTimeToMs(D, 11, 0));
    // holy-day-off +60 and no-school-project-day +35
    expect(a.score).toBeGreaterThanOrEqual(50);
    expect(a.verdict.text).toBe('Yes.');
  });

  it('rainy Saturday leans yes; sunny Saturday leans no', () => {
    const D = '2026-08-08';
    const rainy = makeBrief(D, { weather: { date: D, highF: 66, precipProb: 90 } });
    const sunny = makeBrief(D, { weather: { date: D, highF: 74, precipProb: 5 } });
    expect(assess(rainy, nyTimeToMs(D, 14, 0)).verdict.text).toBe('Probably'); // 35 + 10
    expect(assess(sunny, nyTimeToMs(D, 14, 0)).verdict.text).toBe('No'); // -30 + 10
  });

  it('school day: NO WAY-level at 2pm, positive at 8pm', () => {
    const D = '2026-03-10'; // term-time Tuesday
    const brief = makeBrief(D, { inSchoolTerm: true, schoolDay: true });
    expect(assess(brief, nyTimeToMs(D, 14, 0)).verdict.text).toBe('NO WAY'); // teaching -80
    expect(assess(brief, nyTimeToMs(D, 20, 0)).verdict.text).toBe('Probably'); // +40
  });

  it('plain summer Tuesday afternoon: Yes; 1am: No', () => {
    const D = '2026-08-11';
    const brief = makeBrief(D);
    expect(assess(brief, nyTimeToMs(D, 14, 0)).verdict.text).toBe('Yes.'); // +35 +20
    expect(assess(brief, nyTimeToMs(D, 1, 0)).verdict.text).toBe('No'); // -40
  });

  it('birthday + Liverpool match: hard override with the biggest weight wins', () => {
    const D = '2026-08-20';
    const brief = makeBrief(D, {
      matches: [lfcMatch(D, 15)],
      personal: {
        title: "Mike's Birthday",
        reason: "It's Mike's (and Andrew's) birthday today!!!",
        weight: -100,
        hardOverride: 'NO WAY',
      },
    });
    const a = assess(brief, nyTimeToMs(D, 15, 30));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('birthday'); // -100 beats -95
  });

  it('empty brief at 8am gap yields the maybe fallback', () => {
    const D = '2026-08-11';
    const a = assess(makeBrief(D), nyTimeToMs(D, 8, 0));
    expect(a.verdict.text).toBe('Hmm… maybe?');
  });
});

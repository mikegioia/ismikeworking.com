import { describe, it, expect } from 'vitest';
import { buildBrief } from '../src/build/brief';
import cal from '../calendar/personal.json';
import type { PersonalCalendar } from '../src/providers/personal';
import type { Fixture } from '../src/providers/football';
import { nyTimeToMs } from '../src/lib/time';

const calendar = cal as unknown as PersonalCalendar;

const fixtures: Fixture[] = [
  {
    competition: 'PL', date: '2026-10-03', kickoffUtc: '2026-10-03T14:00:00Z',
    home: 'Liverpool', away: 'Everton', round: '7', isFinal: false, isKnockout: false,
  },
  {
    competition: 'PL', date: '2026-10-04', kickoffUtc: '2026-10-04T15:30:00Z',
    home: 'Arsenal', away: 'Chelsea', round: '7', isFinal: false, isKnockout: false,
  },
];

const forecast = [
  { date: '2026-10-03', highF: 65, precipProb: 20 },
  { date: '2026-10-04', highF: 60, precipProb: 70 },
];

function brief(date: string) {
  return buildBrief({ date, fixtures, forecast, calendar, generatedAtMs: nyTimeToMs(date, 4, 30) });
}

describe('buildBrief', () => {
  it("selects only the day's matches and resolves kickoff epoch", () => {
    const b = brief('2026-10-03');
    expect(b.matches).toHaveLength(1);
    expect(b.matches[0].home).toBe('Liverpool');
    expect(b.matches[0].kickoffMs).toBe(Date.parse('2026-10-03T14:00:00Z'));
  });

  it('dedupes the same match arriving from two feeds', () => {
    const duplicated: Fixture[] = [
      ...fixtures,
      {
        competition: 'PL', date: '2026-10-03', kickoffUtc: '2026-10-03T14:00:00Z',
        home: 'Liverpool', away: 'Everton', round: '7', isFinal: false, isKnockout: false,
      },
    ];
    const b = buildBrief({
      date: '2026-10-03', fixtures: duplicated, forecast, calendar,
      generatedAtMs: nyTimeToMs('2026-10-03', 4, 30),
    });
    expect(b.matches).toHaveLength(1);
  });

  it("attaches the day's weather", () => {
    expect(brief('2026-10-04').weather).toEqual({ date: '2026-10-04', highF: 60, precipProb: 70 });
    expect(brief('2026-10-05').weather).toBeNull();
  });

  it('flags school days correctly', () => {
    const tues = brief('2026-10-06'); // term-time Tuesday, no holy day
    expect(tues).toMatchObject({ inSchoolTerm: true, schoolDay: true, weekday: 2 });
    expect(brief('2026-10-03').schoolDay).toBe(false); // Saturday
    expect(brief('2026-07-14').schoolDay).toBe(false); // summer
  });

  it('a holy day off unsets schoolDay but keeps inSchoolTerm', () => {
    const b = brief('2026-12-08'); // Immaculate Conception, Tuesday
    expect(b.inSchoolTerm).toBe(true);
    expect(b.schoolDay).toBe(false);
    expect(b.liturgical?.dayOff).toBe(true);
  });

  it('attaches personal holidays', () => {
    expect(brief('2026-08-20').personal?.title).toBe("Mike's Birthday");
    expect(brief('2026-10-03').personal).toBeNull();
  });
});

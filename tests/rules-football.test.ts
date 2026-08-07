import { describe, it, expect } from 'vitest';
import { footballRule, BIG_TEAMS } from '../src/engine/rules/football';
import { combine } from '../src/engine/combine';
import { nyTimeToMs, HOUR_MS } from '../src/lib/time';
import { makeBrief } from './helpers';
import type { Match } from '../src/engine/types';

const D = '2026-08-08'; // a Saturday

function match(over: Partial<Match>): Match {
  return {
    competition: 'PL',
    home: 'Burnley',
    away: 'Brentford',
    kickoffMs: nyTimeToMs(D, 10, 0),
    round: '1',
    isFinal: false,
    isKnockout: false,
    ...over,
  };
}

describe('footballRule', () => {
  it('Liverpool live is a hard NO WAY', () => {
    const brief = makeBrief(D, { matches: [match({ home: 'Liverpool', away: 'Everton' })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 11, 0));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('RIGHT NOW');
    const ids = a.signals.map((s) => s.id);
    expect(ids).toContain('lfc-live');
    expect(ids).toContain('lfc-today');
    expect(ids).toContain('pl-matchday');
    expect(ids).not.toContain('big-v-big');
  });

  it('Liverpool matchday drags the whole day down outside the live window', () => {
    const brief = makeBrief(D, { matches: [match({ home: 'Liverpool', away: 'Everton' })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 18, 0));
    const ids = a.signals.map((s) => s.id);
    expect(ids).toContain('lfc-today');
    expect(ids).not.toContain('lfc-live');
    expect(a.score).toBe(-70); // -60 lfc-today + -10 pl-matchday
  });

  it('Liverpool in a final pins NO WAY all day', () => {
    const brief = makeBrief(D, {
      matches: [match({ competition: 'CL', home: 'Liverpool', away: 'Real Madrid', isFinal: true, isKnockout: true })],
    });
    const a = combine(footballRule(brief), nyTimeToMs(D, 8, 0));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('final');
  });

  it('big v big during the match', () => {
    const brief = makeBrief(D, { matches: [match({ home: 'Arsenal', away: 'Chelsea' })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 10, 30));
    expect(a.signals.map((s) => s.id).sort()).toEqual(['big-v-big', 'pl-matchday']);
    expect(a.score).toBe(-50);
  });

  it('single big team during the match', () => {
    const brief = makeBrief(D, { matches: [match({ home: 'Tottenham Hotspur' })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 10, 30));
    expect(a.signals.map((s) => s.id).sort()).toEqual(['big-team', 'pl-matchday']);
  });

  it('plain PL matchday is mild ambience only, all day', () => {
    const brief = makeBrief(D, { matches: [match({})] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 20, 0));
    expect(a.signals.map((s) => s.id)).toEqual(['pl-matchday']);
    expect(a.score).toBe(-10);
  });

  it('two plain PL matches yield one pl-matchday signal', () => {
    const brief = makeBrief(D, {
      matches: [match({}), match({ home: 'Fulham', away: 'Wolves', kickoffMs: nyTimeToMs(D, 12, 30) })],
    });
    const a = combine(footballRule(brief), nyTimeToMs(D, 12, 45));
    expect(a.signals.filter((s) => s.id === 'pl-matchday')).toHaveLength(1);
  });

  it('CL knockout and group tiers', () => {
    const ko = makeBrief(D, {
      matches: [match({ competition: 'CL', home: 'Villarreal', away: 'Porto', isKnockout: true })],
    });
    expect(combine(footballRule(ko), nyTimeToMs(D, 10, 30)).score).toBe(-40);

    const group = makeBrief(D, {
      matches: [match({ competition: 'CL', home: 'Villarreal', away: 'Porto' })],
    });
    expect(combine(footballRule(group), nyTimeToMs(D, 10, 30)).score).toBe(-15);
  });

  it('null kickoff gets an all-day window at 0.7 confidence', () => {
    const brief = makeBrief(D, { matches: [match({ home: 'Manchester City', kickoffMs: null })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 21, 0));
    const big = a.signals.find((s) => s.id === 'big-team')!;
    expect(big.contribution).toBe(Math.round(-25 * 0.7));
  });

  it('matches TheSportsDB full team names', () => {
    const bigVBig = makeBrief(D, {
      matches: [match({ home: 'Manchester City', away: 'Arsenal' })],
    });
    const a = combine(footballRule(bigVBig), nyTimeToMs(D, 10, 30));
    expect(a.signals.map((s) => s.id)).toContain('big-v-big');

    const bigTeam = makeBrief(D, {
      matches: [match({ home: 'Tottenham Hotspur', away: 'Burnley' })],
    });
    const b = combine(footballRule(bigTeam), nyTimeToMs(D, 10, 30));
    expect(b.signals.map((s) => s.id)).toContain('big-team');
  });

  it('exposes the big teams list', () => {
    expect(BIG_TEAMS).toContain('Liverpool');
    expect(BIG_TEAMS).toHaveLength(6);
  });
});

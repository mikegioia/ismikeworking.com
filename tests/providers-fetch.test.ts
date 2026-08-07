import { describe, it, expect } from 'vitest';
import { seasonSlug, normalizeEvents } from '../src/providers/football';
import { normalizeForecast } from '../src/providers/weather';

describe('seasonSlug', () => {
  it('uses current-next across July–December', () => {
    expect(seasonSlug('2026-08-07')).toBe('2026-2027');
    expect(seasonSlug('2026-12-31')).toBe('2026-2027');
  });
  it('uses previous-current across January–June', () => {
    expect(seasonSlug('2026-03-01')).toBe('2025-2026');
  });
});

describe('normalizeEvents', () => {
  const raw = [
    {
      strHomeTeam: 'Liverpool', strAwayTeam: 'Everton',
      dateEvent: '2026-10-03', strTimestamp: '2026-10-03T14:00:00',
      intRound: '7',
    },
    {
      strHomeTeam: 'Bayern Munich', strAwayTeam: 'Real Madrid',
      dateEvent: '2027-06-05', strTimestamp: null,
      intRound: '160', strEvent: 'Champions League Final',
    },
    { strHomeTeam: null, strAwayTeam: 'Ghost FC', dateEvent: '2026-10-03' },
  ];

  it('normalizes fields and parses UTC kickoff', () => {
    const fx = normalizeEvents(raw, 'PL');
    expect(fx[0]).toEqual({
      competition: 'PL',
      date: '2026-10-03',
      kickoffUtc: '2026-10-03T14:00:00Z',
      home: 'Liverpool',
      away: 'Everton',
      round: '7',
      isFinal: false,
      isKnockout: false,
    });
  });

  it('detects finals by round code and name, knockouts by month for CL', () => {
    const fx = normalizeEvents(raw, 'CL');
    const final = fx.find((f) => f.home === 'Bayern Munich')!;
    expect(final.isFinal).toBe(true);
    expect(final.isKnockout).toBe(true);
    expect(final.kickoffUtc).toBeNull();
  });

  it('drops malformed events', () => {
    expect(normalizeEvents(raw, 'PL')).toHaveLength(2);
  });

  it('detects finals via strFilename even when strEvent is a plain name', () => {
    const fx = normalizeEvents(
      [
        {
          strHomeTeam: 'Bayern Munich', strAwayTeam: 'Real Madrid',
          dateEvent: '2027-06-05', strTimestamp: null,
          intRound: '2', strEvent: 'Bayern Munich vs Real Madrid',
          strFilename: 'Europa League 2027-06-05 Final',
        },
      ],
      'EL'
    );
    expect(fx[0].isFinal).toBe(true);
  });
});

describe('normalizeForecast', () => {
  it('zips Open-Meteo daily arrays', () => {
    const days = normalizeForecast({
      daily: {
        time: ['2026-08-07', '2026-08-08'],
        temperature_2m_max: [88.3, 74.1],
        precipitation_probability_max: [10, 80],
      },
    });
    expect(days).toEqual([
      { date: '2026-08-07', highF: 88, precipProb: 10 },
      { date: '2026-08-08', highF: 74, precipProb: 80 },
    ]);
  });

  it('returns empty on malformed response', () => {
    expect(normalizeForecast({})).toEqual([]);
  });
});

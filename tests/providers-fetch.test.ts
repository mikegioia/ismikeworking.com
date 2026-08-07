import { describe, it, expect } from 'vitest';
import {
  seasonSlug,
  normalizeEvents,
  normalizeTeamEvents,
  roundCodes,
  dedupeEvents,
} from '../src/providers/football';
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

describe('normalizeTeamEvents', () => {
  const raw = [
    {
      strHomeTeam: 'Liverpool', strAwayTeam: 'Monaco',
      dateEvent: '2026-08-09', strTimestamp: '2026-08-09T13:30:00',
      intRound: '0', strLeague: 'Club Friendlies',
    },
    {
      strHomeTeam: 'Liverpool', strAwayTeam: 'Everton',
      dateEvent: '2026-10-03', strTimestamp: '2026-10-03T14:00:00',
      intRound: '7', strLeague: 'English Premier League',
    },
    {
      strHomeTeam: 'Real Madrid', strAwayTeam: 'Liverpool',
      dateEvent: '2026-11-04', strTimestamp: '2026-11-04T20:00:00',
      intRound: '4', strLeague: 'UEFA Champions League',
    },
  ];

  it('maps strLeague to the known competitions', () => {
    const fx = normalizeTeamEvents(raw);
    expect(fx.map((f) => f.competition)).toEqual(['CUP', 'PL', 'CL']);
  });

  it('normalizes the same fields as league events', () => {
    const fx = normalizeTeamEvents(raw);
    expect(fx[1]).toMatchObject({
      home: 'Liverpool',
      away: 'Everton',
      date: '2026-10-03',
      kickoffUtc: '2026-10-03T14:00:00Z',
      round: '7',
    });
  });

  it('drops malformed events', () => {
    expect(normalizeTeamEvents([{ strHomeTeam: null, dateEvent: '2026-08-09' }])).toHaveLength(0);
  });
});

describe('roundCodes', () => {
  it('PL is rounds 1 through 38', () => {
    const codes = roundCodes('PL');
    expect(codes).toHaveLength(38);
    expect(codes[0]).toBe('1');
    expect(codes[37]).toBe('38');
  });

  it('CL/EL sweep league-phase, knockout, and qualifying codes', () => {
    for (const comp of ['CL', 'EL'] as const) {
      const codes = roundCodes(comp);
      for (const required of ['1', '8', '125', '150', '160', '400']) {
        expect(codes).toContain(required);
      }
    }
  });
});

describe('dedupeEvents', () => {
  it('dedupes by idEvent when present', () => {
    const events = [
      { idEvent: '1001', strHomeTeam: 'Liverpool', strAwayTeam: 'Everton', dateEvent: '2026-10-03' },
      { idEvent: '1001', strHomeTeam: 'Liverpool', strAwayTeam: 'Everton', dateEvent: '2026-10-03' },
      { idEvent: '1002', strHomeTeam: 'Fulham', strAwayTeam: 'Wolves', dateEvent: '2026-10-03' },
    ];
    expect(dedupeEvents(events)).toHaveLength(2);
  });

  it('falls back to date|home|away when idEvent is missing', () => {
    const events = [
      { strHomeTeam: 'Liverpool', strAwayTeam: 'Everton', dateEvent: '2026-10-03' },
      { strHomeTeam: 'Liverpool', strAwayTeam: 'Everton', dateEvent: '2026-10-03' },
      { strHomeTeam: 'Liverpool', strAwayTeam: 'Everton', dateEvent: '2027-02-13' },
    ];
    expect(dedupeEvents(events)).toHaveLength(2);
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

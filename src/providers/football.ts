export interface Fixture {
  competition: 'PL' | 'CL' | 'EL';
  date: string;
  kickoffUtc: string | null;
  home: string;
  away: string;
  round: string;
  isFinal: boolean;
  isKnockout: boolean;
}

export const LEAGUE_IDS = { PL: 4328, CL: 4480, EL: 4481 } as const;

const KNOCKOUT_ROUNDS = new Set(['125', '150', '160', '200']);

export function seasonSlug(nyDate: string): string {
  const year = Number(nyDate.slice(0, 4));
  const month = Number(nyDate.slice(5, 7));
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

interface RawEvent {
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  dateEvent?: string | null;
  strTimestamp?: string | null;
  intRound?: string | null;
  strEvent?: string | null;
  strFilename?: string | null;
}

export function normalizeEvents(events: unknown[], competition: Fixture['competition']): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const raw of events as RawEvent[]) {
    if (!raw?.strHomeTeam || !raw.strAwayTeam || !raw.dateEvent) continue;
    const round = raw.intRound ?? '';
    const nameHasFinal =
      /\bFinal\b/i.test(raw.strEvent ?? '') || /\bFinal\b/i.test(raw.strFilename ?? '');
    const isFinal = round === '160' || nameHasFinal;
    const month = Number(raw.dateEvent.slice(5, 7));
    const isKnockout =
      isFinal ||
      KNOCKOUT_ROUNDS.has(round) ||
      (competition !== 'PL' && month >= 2 && month <= 6);
    fixtures.push({
      competition,
      date: raw.dateEvent,
      kickoffUtc: raw.strTimestamp ? `${raw.strTimestamp.replace(/Z?$/, '')}Z` : null,
      home: raw.strHomeTeam,
      away: raw.strAwayTeam,
      round,
      isFinal,
      isKnockout,
    });
  }
  return fixtures;
}

export async function fetchFixtures(
  competition: Fixture['competition'],
  season: string
): Promise<Fixture[]> {
  const key = process.env.THESPORTSDB_KEY ?? '123';
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${LEAGUE_IDS[competition]}&s=${season}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB ${competition} ${season}: HTTP ${res.status}`);
  const body = (await res.json()) as { events?: unknown[] | null };
  return normalizeEvents(body.events ?? [], competition);
}

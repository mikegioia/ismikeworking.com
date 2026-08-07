export interface Fixture {
  competition: 'PL' | 'CL' | 'EL' | 'CUP';
  date: string;
  kickoffUtc: string | null;
  home: string;
  away: string;
  round: string;
  isFinal: boolean;
  isKnockout: boolean;
}

export const LEAGUE_IDS = { PL: 4328, CL: 4480, EL: 4481 } as const;

export const LIVERPOOL_TEAM_ID = 133602;

/** strLeague values from team feeds mapped to our competition codes; anything else is CUP. */
const LEAGUE_NAMES: Record<string, Fixture['competition']> = {
  'English Premier League': 'PL',
  'UEFA Champions League': 'CL',
  'UEFA Europa League': 'EL',
};

const KNOCKOUT_ROUNDS = new Set(['125', '150', '160', '200']);

export function seasonSlug(nyDate: string): string {
  const year = Number(nyDate.slice(0, 4));
  const month = Number(nyDate.slice(5, 7));
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

interface RawEvent {
  idEvent?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  dateEvent?: string | null;
  strTimestamp?: string | null;
  intRound?: string | null;
  strEvent?: string | null;
  strFilename?: string | null;
  strLeague?: string | null;
}

/**
 * Round codes to page through per competition. The free-tier API caps
 * eventsseason.php at 15 events, but eventsround.php returns full rounds,
 * so a per-round sweep recovers the whole season.
 *
 * PL plays a plain 38-round season. CL/EL use TheSportsDB's special codes
 * on top of the league-phase rounds: 100/125/150/160/180/200 for the
 * knockout stages, 400/410/420/430 for qualifying, 500 for playoffs.
 * Rounds that don't exist for a season just return no events.
 */
export function roundCodes(competition: Fixture['competition']): string[] {
  if (competition === 'PL') {
    return Array.from({ length: 38 }, (_, i) => String(i + 1));
  }
  return [
    ...Array.from({ length: 10 }, (_, i) => String(i + 1)),
    '100', '125', '150', '160', '180', '200',
    '400', '410', '420', '430', '500',
  ];
}

/** Dedupe raw events by idEvent, falling back to date|home|away. */
export function dedupeEvents(events: RawEvent[]): RawEvent[] {
  const seen = new Set<string>();
  const unique: RawEvent[] = [];
  for (const e of events) {
    const key = e.idEvent ?? `${e.dateEvent}|${e.strHomeTeam}|${e.strAwayTeam}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  return unique;
}

function normalizeEvent(raw: RawEvent, competition: Fixture['competition']): Fixture | null {
  if (!raw?.strHomeTeam || !raw.strAwayTeam || !raw.dateEvent) return null;
  const round = raw.intRound ?? '';
  const nameHasFinal =
    /\bFinal\b/i.test(raw.strEvent ?? '') || /\bFinal\b/i.test(raw.strFilename ?? '');
  const isFinal = round === '160' || nameHasFinal;
  const month = Number(raw.dateEvent.slice(5, 7));
  const isKnockout =
    isFinal ||
    KNOCKOUT_ROUNDS.has(round) ||
    ((competition === 'CL' || competition === 'EL') && month >= 2 && month <= 6);
  return {
    competition,
    date: raw.dateEvent,
    kickoffUtc: raw.strTimestamp ? `${raw.strTimestamp.replace(/Z?$/, '')}Z` : null,
    home: raw.strHomeTeam,
    away: raw.strAwayTeam,
    round,
    isFinal,
    isKnockout,
  };
}

export function normalizeEvents(events: unknown[], competition: Fixture['competition']): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const raw of events as RawEvent[]) {
    const fixture = normalizeEvent(raw, competition);
    if (fixture) fixtures.push(fixture);
  }
  return fixtures;
}

/** Normalize a team feed, where each event carries its own competition via strLeague. */
export function normalizeTeamEvents(events: unknown[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const raw of events as RawEvent[]) {
    const competition = LEAGUE_NAMES[raw?.strLeague ?? ''] ?? 'CUP';
    const fixture = normalizeEvent(raw, competition);
    if (fixture) fixtures.push(fixture);
  }
  return fixtures;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Free-tier rate limit is roughly 30 requests/minute; on 429, wait out the window once. */
const RATE_LIMIT_BACKOFF_MS = 65_000;

async function getEvents(url: string): Promise<RawEvent[]> {
  const res = await fetch(url);
  if (res.status === 429) {
    console.warn(`WARN: rate limited, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
    await sleep(RATE_LIMIT_BACKOFF_MS);
    const retry = await fetch(url);
    if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
    const body = (await retry.json()) as { events?: unknown[] | null };
    return (body.events ?? []) as RawEvent[];
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { events?: unknown[] | null };
  return (body.events ?? []) as RawEvent[];
}

/**
 * Fetches a full season by paging eventsround.php per round, with one
 * eventsseason.php call merged in as a backstop, deduped by event id.
 * Individual round failures are logged and skipped; throws only when the
 * whole sweep produced nothing, so the caller keeps its existing data file.
 */
export async function fetchFixtures(
  competition: keyof typeof LEAGUE_IDS,
  season: string
): Promise<Fixture[]> {
  const key = process.env.THESPORTSDB_KEY ?? '123';
  const delayMs = Number(process.env.FETCH_DELAY_MS ?? 2500);
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  const leagueId = LEAGUE_IDS[competition];

  const urls = [
    ...roundCodes(competition).map(
      (r) => `${base}/eventsround.php?id=${leagueId}&r=${r}&s=${season}`
    ),
    `${base}/eventsseason.php?id=${leagueId}&s=${season}`,
  ];

  const raw: RawEvent[] = [];
  let failures = 0;

  for (const url of urls) {
    try {
      raw.push(...(await getEvents(url)));
    } catch (err) {
      failures += 1;
      console.warn(`WARN: TheSportsDB ${competition} ${season} request failed (${err})`);
    }
    await sleep(delayMs);
  }

  const fixtures = normalizeEvents(dedupeEvents(raw), competition);

  if (fixtures.length === 0) {
    throw new Error(
      `TheSportsDB ${competition} ${season}: no fixtures returned (${failures} failed requests)`
    );
  }

  return fixtures;
}

/**
 * Fetches Liverpool's upcoming fixtures across ALL competitions (cups,
 * friendlies, European games) via the team feed. The free tier returns
 * only the next handful of events, but the daily refresh keeps that
 * rolling window covering today, which is all the engine needs.
 * An empty result is legitimate (e.g. season over), not an error.
 */
export async function fetchLiverpoolFixtures(): Promise<Fixture[]> {
  const key = process.env.THESPORTSDB_KEY ?? '123';
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsnext.php?id=${LIVERPOOL_TEAM_ID}`;
  return normalizeTeamEvents(await getEvents(url));
}

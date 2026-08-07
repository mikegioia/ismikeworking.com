# ismikeworking.com

A very serious real-time answer to a very serious question: **is Mike working
on his personal projects right now?**

A weighted rule engine combines football fixtures (Liverpool above all),
the Catholic school calendar, the weather in West Chester, and a personal
calendar into one of: **Yes.** · **Probably** · **Hmm… maybe?** · **No** ·
**Nope** · **NO WAY**.

## How it works

- A daily GitHub Action (`.github/workflows/daily.yml`) fetches fixtures
  (TheSportsDB) and weather (Open-Meteo) into `data/` and commits.
- The push triggers Render's static build (`render.yaml`): `npm run build`
  compiles `data/daybrief.json` and prerenders `web/index.html`.
- The same rule engine ships to the browser and re-evaluates every minute
  in America/New_York — the verdict changes at kickoff, at the school bell,
  and at bedtime, with no server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the engine test suite |
| `npm run fetch` | Pull fixtures + weather into `data/` |
| `npm run compile` | Build `data/daybrief.json` (add `-- --date YYYY-MM-DD` to time-travel) |
| `npm run build` | Compile + prerender the site into `web/` |

**TheSportsDB key:** The free key (`123`) caps `eventsseason` responses at 15
events, so the fetcher pages `eventsround.php` per round instead and merges the
season endpoint in as a backstop — full-season data on the free tier. The sweep
paces itself under the ~30 req/min rate limit (about 5 minutes; tune with
`FETCH_DELAY_MS`, default 2500) and backs off once on HTTP 429. A premium key
via the `THESPORTSDB_KEY` environment variable also works and can be paced
faster.

## Tuning the rules

- Rule weights and windows: `src/engine/rules/*.ts`
- Verdict thresholds: `src/engine/verdicts.ts` (`LADDER`)
- School terms, vacations, birthdays, Irwin days: `calendar/personal.json`
- Holy days: `src/providers/liturgical.ts`

Adding a rule: write a `Rule` in `src/engine/rules/`, register it in
`src/engine/rules/index.ts`, add a test in `tests/`.

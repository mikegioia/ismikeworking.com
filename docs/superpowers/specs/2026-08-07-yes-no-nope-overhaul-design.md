# ismikeworking.com — Yes/No/Nope Overhaul Design

**Date:** 2026-08-07
**Status:** Approved

## Purpose

Rebuild ismikeworking.com as its original intent: a silly single-purpose site
that answers "Is Mike working on his personal projects right now?" with a giant
verdict — "Yes.", "Probably", "No", "Nope", "NO WAY" — driven by a weighted
rule engine fed by external data (Liverpool FC fixtures, the Catholic
liturgical calendar, weather, and a personal calendar).

The rule system is the heart of the app. It must be declarative, testable, and
extensible so new signal sources can be added later without touching the core.

## Constraints

- Must run on the **Render free tier**: static site hosting only, no paid cron.
- Answer must be **live to the time of day** (e.g., "NO WAY" during a Liverpool
  match, relaxed after full time) with **no cold starts**.
- All times evaluated in **America/New_York**. Weather location: **West
  Chester, PA (19380)**.

## Architecture

Static site on Render + GitHub Actions as the free cron.

1. A scheduled GitHub Action runs daily (~4:30am ET) and on every push.
2. The Action runs the **fetch** stage, commits refreshed `data/*.json`, and
   pushes. That push triggers Render's static-site auto-deploy.
3. Render's build command runs **compile + render**, publishing `web/`.
4. The **client engine** (same TypeScript rule engine, bundled) re-evaluates
   the verdict in the visitor's browser every minute against the inlined "day
   brief" and the current clock, converted to America/New_York.
5. A build-time prerendered verdict is baked into the HTML as the no-JS
   fallback.

### Build pipeline (Node + TypeScript + Vite)

- **Fetch** (`src/build/fetch.ts`): each provider pulls external data into
  `data/*.json`. Failures keep the last committed data; the build proceeds.
- **Compile** (`src/build/compile.ts`): distills all data into a small **day
  brief** — today's relevant events with resolved time windows.
- **Render** (`src/build/render.ts` + Vite): emits `web/index.html` with the
  day brief inlined as JSON plus the client bundle.

### Providers (`src/providers/`)

| Provider | Source | Notes |
|---|---|---|
| Football | TheSportsDB free API | Premier League, Champions League, Europa League fixtures with kickoff times and rounds |
| Weather | Open-Meteo (free, no key) | 7-day forecast for West Chester, PA |
| Liturgical | Computed locally | Easter-cycle algorithm + fixed-feast table; no API |
| Personal | `calendar/personal.json` | Hand-maintained: birthdays, Irwin days, school-year terms, vacations |

## Rule Engine (`src/engine/`)

### Signals

Every rule evaluates the day brief + current time and may emit a signal:

```ts
interface Signal {
  id: string;            // stable rule id, e.g. "liverpool-live"
  label: string;         // short name shown in the breakdown
  weight: number;        // signed: positive = working, negative = not working
  confidence: number;    // 0..1 multiplier
  window: TimeWindow;    // all-day or start–end (America/New_York)
  reason: string;        // witty one-liner
  hardOverride?: Verdict; // pins the verdict regardless of score
}
```

### Combiner

- Sum `weight × confidence` over all signals whose window contains "now" →
  score, roughly −100…+100.
- Hard overrides trump the math; if several fire, the one with the largest
  |weight| wins.
- The strongest active signal supplies the headline reason; all active signals
  appear in the "why?" breakdown with their weights and the total.

### Verdict ladder

| Score | Verdict | Color |
|---|---|---|
| ≥ +50 | Yes. | green |
| +20…+49 | Probably | yellow-green |
| −19…+19 | Hmm… maybe? | amber |
| −20…−49 | No | orange-red |
| −50…−79 | Nope | red |
| ≤ −80 or hard override | NO WAY | deep crimson |

Thresholds live in one tunable table.

### Starter rule set

**Football**
- Liverpool playing right now (kickoff −30min → kickoff +2h30m): hard
  override NO WAY
- Liverpool match today, rest of the day outside the live window: −60 all day
- Liverpool in a cup final: hard override NO WAY, all day
- Big team v big team (Liverpool, Man City, Arsenal, Man United, Chelsea,
  Tottenham; extendable list): −40 during match window
- Any big team playing: −25 during match window
- Any PL matchday: −10 all day
- CL/EL: finals −70 all day; knockout-round matches −40 during match window;
  group-stage matches −15 during match window

**School** (school-year terms defined in `calendar/personal.json`)
- School-year weekday, 7:30am–3:30pm: −80 ("Mike is busy molding young minds")
- School-year weekday evening: +40 (baseline project time)
- Religious holiday during school year: +60 ("Day off from teaching — Mike is
  absolutely at his desk")

**Weather** (weekends and non-school days)
- Nice forecast: −30 ("74° and sunny — he's outside")
- Bad forecast: +35

**Personal**
- Mike's birthday (08-20): hard override "No way!"
- Ashley's birthday (09-12): No
- Steve Irwin's Birthday (02-22), World Wildlife Day (03-03), Earth Day
  (04-22), National Honey Bee Day (08-22), Steve Irwin Day (11-15): No, with
  the existing flavor text
- Christmas (12-25), New Year's Day (01-01): Probably — "one of the best days
  to get stuff done"

**Baselines**
- Plain weekday evening: +30
- Weekend daytime: +10
- After ~11pm: negative ("he should be asleep")

Adding a rule = one declarative entry + a unit test. Future extensions (match
importance from league position, LLM-written one-liners, form tracking) plug
in as new providers/signals.

## The Page

Giant Verdict style:

- Full-viewport verdict word; page background sweeps green → amber → deep
  crimson with the verdict.
- Witty one-liner beneath (headline reason).
- Subtle **"why?"** link expanding the fired signals with weights and the
  score math.
- Small "last updated" timestamp; live re-render as the clock crosses rule
  windows.
- Existing favicons carry over.

## Repo Shape

```
src/engine/      types, rules, combiner, verdict ladder (shared build + client)
src/providers/   football, weather, liturgical, personal
src/build/       fetch / compile / render scripts
src/site/        index template, main.ts, styles
calendar/personal.json
data/            fetched JSON (committed daily by the Action)
web/             build output → Render publish directory
.github/workflows/daily.yml
```

### Migration

Delete the old PHP (`src/*.php`, `compile.php`, `download.php`,
`template.phtml`, `v1/`, 2019 `data/` backups) — git history preserves it.
Keep `web/` favicons.

## Error Handling

- Provider fetch failure → keep last committed data file, log a warning, build
  proceeds. Missing data simply means those rules emit no signals.
- The engine always produces a verdict: baseline rules need no external data.
- Client engine failure → the prerendered fallback verdict remains visible.

## Testing

Vitest unit tests on the engine with a frozen clock:

- Liverpool matchday: at kickoff, mid-match, 9pm after
- Holy day of obligation on a school-year Tuesday
- Rainy Saturday vs. sunny Saturday
- School day at 2pm vs. 8pm
- Plain Tuesday evening; 1am any day
- Hard-override precedence (birthday + Liverpool match same day)
- Verdict-ladder boundary scores

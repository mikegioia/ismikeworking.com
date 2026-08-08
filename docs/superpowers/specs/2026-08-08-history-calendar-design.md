# Day-Level Reports + History Calendar — Design

**Date:** 2026-08-08
**Status:** Approved

## Goal

Two related changes:

1. The site reports **the day's verdict**, not a time-of-day verdict. No more
   "Mike is asleep" at 5am, and no more "data robot overslept" fallback — a
   stale build shows the previous day's report, honestly labeled with its date.
2. The system **logs a daily snapshot** of each day's report and displays the
   log in a **month-grid calendar** hidden behind a "history" link on the main
   page.

Decisions made during brainstorming:

- **Snapshot depth:** full breakdown (verdict, headline, score, fired signals).
- **Placement:** hidden on the main page; a "history" link expands the calendar
  in place. No separate URL.
- **Backfill:** none. History starts accumulating the day this ships.
- **Day-verdict semantics:** midday anchor (see below). Accepted trade-off:
  evening-only signals (e.g. a 9pm match, after-school hours) do not appear in
  the day's report.

## 1. Day-level report

The canonical assessment for a day is `assess(brief, noonMs)` where
`noonMs = brief.dayStartMs + 12 * HOUR_MS` — the same anchor `render.ts`
already uses for `--date` time-travel builds.

Changes:

- **`src/build/render.ts`**: always assess at the noon anchor (currently
  conditional on brief date ≠ today). The baked page *is* the day's report.
- **`src/site/main.ts`**: remove the live-clock assessment, the 60-second
  re-render interval, and the `STALE` fallback assessment. The client no longer
  re-computes the verdict at all.
- **Footer line**: changes from "as of {live timestamp}" to
  "report for {full date}" rendered from `brief.date` at build time.
- **Stale hint (client JS)**: on load (and on visibility change), compare the
  visitor's current NY date to `brief.date`. If the visitor's date is ahead,
  show a quiet line: "Today's report hasn't landed yet — this is
  {weekday}'s." The old report remains the page content; only the hint is
  dynamic.

The client bundle keeps: theme switcher, stale hint, history calendar.

## 2. Snapshot logging

**Workflow** (`.github/workflows/daily.yml`): after `npm run fetch`, add
`npm run compile` and `npm run snapshot`. The existing `git add data` commit
step picks up the new/changed files unchanged.

**`src/build/snapshot.ts`** (`npm run snapshot`):

1. Read the freshly compiled `data/daybrief.json`.
2. Compute `assess(brief, noonMs)` — identical to what the site will display.
3. Upsert into `data/history.json` under `days[brief.date]`.

**`data/history.json` shape:**

```json
{
  "days": {
    "2026-08-08": {
      "verdict": { "text": "No", "level": 4 },
      "score": -30,
      "headline": "It's the weekend — anything can happen.",
      "signals": [
        { "id": "weekend-baseline", "label": "Weekend",
          "contribution": 10, "reason": "It's the weekend — anything can happen." }
      ]
    }
  }
}
```

Entries store only what the calendar needs: no windows, weights, or
confidence — just `id`, `label`, `contribution`, `reason` per signal.
~300 bytes/day; one file holds years.

Properties:

- **Idempotent:** upsert keyed by date, so push-triggered reruns on the same
  day overwrite that day's entry.
- **Consistent:** snapshot and site use the same noon-anchor assessment, so
  the history entry for day X equals what the site displayed on day X.
- **Forward-only:** no backfill; dates before launch simply have no entry.

## 3. Calendar UI

- A small **"history" link** sits near the theme dots. First activation
  lazily fetches `assets/history.json` and expands the calendar section in
  place; subsequent activations toggle visibility.
- **Build:** the build copies `data/history.json` to `web/assets/history.json`.
- **Month grid:** Monday-first columns; one cell per day of the displayed
  month; cells tinted by verdict level 1–6 reusing the existing `level-*`
  theme color tokens. All date math in America/New_York via `lib/time`.
- **Navigation:** prev/next month arrows, clamped to
  [earliest logged month, current month].
- **Empty cells:** days without an entry (pre-launch, missed workflow runs)
  render neutral/untinted.
- **Day detail:** clicking a logged day opens a breakdown panel below the
  grid — date, verdict, headline, signal list — same visual language as the
  main page's "why?" breakdown.

## 4. Error handling

- `snapshot.ts` must never fail the workflow: wrap in try/catch, warn and
  exit 0, leaving the existing `history.json` untouched (same philosophy as
  `fetch.ts`'s `attempt()`).
- Malformed or missing `history.json` → treat as `{ "days": {} }` with a
  warning; the file is rebuilt entry by entry from then on.
- Browser fetch of `assets/history.json` fails → the history section shows
  "history unavailable" instead of the calendar.

## 5. Testing

Vitest units (implementation to follow TDD):

- **Snapshot upsert:** creates file when absent; overwrites the same day on
  rerun; preserves other days; falls back to empty on malformed JSON.
- **Month grid generation:** month boundary layout, Monday-first alignment,
  NY-timezone correctness across DST transitions.
- **Stale hint:** date comparison logic (brief date vs. visitor NY date).

Engine (`src/engine/*`) is untouched; existing tests stand.

## Out of scope

- Backfilling history before launch day.
- A separate /history page or stats/aggregates.
- Year-heatmap view.
- Re-tuning the verdict ladder (unchanged under midday anchor).

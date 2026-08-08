# Day-Level Reports + History Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The site reports one canonical noon-anchored verdict per day, logs each day's report to `data/history.json` via the daily workflow, and shows the log in a month-grid calendar behind a "history" link.

**Architecture:** A pure history module (`src/lib/history.ts`) is shared by a new snapshot build script and the client calendar. `render.ts` bakes the noon-anchor assessment into the static page; the client no longer re-computes verdicts — it only handles themes, a stale-day hint, and the lazily-fetched calendar. Spec: `docs/superpowers/specs/2026-08-08-history-calendar-design.md`.

**Tech Stack:** TypeScript, esbuild (bundle), tsx (build scripts), Vitest, GitHub Actions, Render static hosting.

## Global Constraints

- All date math for "which day is it" uses America/New_York via `src/lib/time.ts` helpers (`nyDateString`, `HOUR_MS`).
- The canonical day assessment is `assess(brief, brief.dayStartMs + 12 * HOUR_MS)` — noon anchor, everywhere (site build and snapshot).
- `data/history.json` shape: `{ "days": { "YYYY-MM-DD": HistoryEntry } }`; entries carry only `verdict {text, level}`, `score`, `headline`, `signals [{id, label, contribution, reason}]`.
- Snapshot must never fail the workflow: catch, warn, exit 0.
- History is forward-only — no backfill.
- Calendar: Monday-first month grid; cells tinted by verdict level via theme color tokens; nav clamped to [earliest logged month, current month].
- The engine (`src/engine/*`) is untouched.
- Run `npm test` (Vitest) after every implementation step; all tests must pass before each commit.

---

### Task 1: History module (`src/lib/history.ts`)

**Files:**
- Create: `src/lib/history.ts`
- Test: `tests/history.test.ts`

**Interfaces:**
- Consumes: `Assessment` from `src/engine/types.ts` (`{ verdict: { text, level }, score, headline, signals: ActiveSignal[] }`).
- Produces (later tasks rely on these exact names):
  - `interface HistorySignal { id: string; label: string; contribution: number; reason: string }`
  - `interface HistoryEntry { verdict: { text: string; level: number }; score: number; headline: string; signals: HistorySignal[] }`
  - `interface HistoryFile { days: Record<string, HistoryEntry> }`
  - `toHistoryEntry(a: Assessment): HistoryEntry`
  - `parseHistory(text: string | null): HistoryFile`
  - `upsertDay(history: HistoryFile, date: string, entry: HistoryEntry): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/history.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toHistoryEntry, parseHistory, upsertDay, type HistoryEntry } from '../src/lib/history';
import type { Assessment } from '../src/engine/types';

const assessment: Assessment = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    {
      id: 'weekend-baseline',
      label: 'Weekend',
      weight: 10,
      confidence: 1,
      window: { startMs: 0, endMs: 1 },
      reason: "It's the weekend — anything can happen.",
      contribution: 10,
    },
  ],
};

const entry: HistoryEntry = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    {
      id: 'weekend-baseline',
      label: 'Weekend',
      contribution: 10,
      reason: "It's the weekend — anything can happen.",
    },
  ],
};

describe('toHistoryEntry', () => {
  it('keeps verdict, score, headline, and slims signals to id/label/contribution/reason', () => {
    expect(toHistoryEntry(assessment)).toEqual(entry);
  });
});

describe('parseHistory', () => {
  it('parses a valid history file', () => {
    const text = JSON.stringify({ days: { '2026-08-08': entry } });
    expect(parseHistory(text).days['2026-08-08']).toEqual(entry);
  });

  it('returns empty history for null input', () => {
    expect(parseHistory(null)).toEqual({ days: {} });
  });

  it('returns empty history for malformed JSON', () => {
    expect(parseHistory('{nope')).toEqual({ days: {} });
  });

  it('returns empty history when days is missing', () => {
    expect(parseHistory('{"other": 1}')).toEqual({ days: {} });
  });
});

describe('upsertDay', () => {
  it('adds a new day', () => {
    const h = { days: {} };
    upsertDay(h, '2026-08-08', entry);
    expect(h.days['2026-08-08']).toEqual(entry);
  });

  it('overwrites the same day and preserves others', () => {
    const other: HistoryEntry = { ...entry, score: 55, verdict: { text: 'Yes.', level: 1 } };
    const h = { days: { '2026-08-07': other } };
    upsertDay(h, '2026-08-08', entry);
    upsertDay(h, '2026-08-08', { ...entry, score: 0 });
    expect(h.days['2026-08-08'].score).toBe(0);
    expect(h.days['2026-08-07']).toEqual(other);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/history.test.ts`
Expected: FAIL — cannot resolve `../src/lib/history`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/history.ts`:

```ts
import type { Assessment } from '../engine/types';

export interface HistorySignal {
  id: string;
  label: string;
  contribution: number;
  reason: string;
}

export interface HistoryEntry {
  verdict: { text: string; level: number };
  score: number;
  headline: string;
  signals: HistorySignal[];
}

export interface HistoryFile {
  days: Record<string, HistoryEntry>;
}

export function toHistoryEntry(a: Assessment): HistoryEntry {
  return {
    verdict: { text: a.verdict.text, level: a.verdict.level },
    score: a.score,
    headline: a.headline,
    signals: a.signals.map(({ id, label, contribution, reason }) => ({
      id, label, contribution, reason,
    })),
  };
}

export function parseHistory(text: string | null): HistoryFile {
  if (text) {
    try {
      const parsed = JSON.parse(text) as Partial<HistoryFile>;
      if (parsed && typeof parsed.days === 'object' && parsed.days !== null) {
        return { days: parsed.days };
      }
    } catch {
      // fall through to the warning below
    }
    console.warn('WARN: history.json malformed, starting fresh');
  }
  return { days: {} };
}

export function upsertDay(history: HistoryFile, date: string, entry: HistoryEntry): void {
  history.days[date] = entry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.ts tests/history.test.ts
git commit -m "Add history module: entry shape, tolerant parse, upsert-by-date"
```

---

### Task 2: Snapshot script + workflow step

**Files:**
- Create: `src/build/snapshot.ts`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/daily.yml`

**Interfaces:**
- Consumes: `parseHistory`, `toHistoryEntry`, `upsertDay` from `src/lib/history.ts` (Task 1); `assess` from `src/engine/evaluate.ts`; `HOUR_MS` from `src/lib/time.ts`; `data/daybrief.json` (produced by `npm run compile`).
- Produces: `data/history.json` on disk; `npm run snapshot` script. No exports.

- [ ] **Step 1: Write the script**

This is a thin I/O wrapper around Task 1's tested logic, so it gets script-level verification (run it twice, assert idempotence) rather than a unit test.

Create `src/build/snapshot.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assess } from '../engine/evaluate';
import { parseHistory, toHistoryEntry, upsertDay } from '../lib/history';
import { HOUR_MS } from '../lib/time';
import type { DayBrief } from '../engine/types';

const root = new URL('../../', import.meta.url).pathname;

// Never fail the workflow: a bad day loses one snapshot, not the pipeline.
try {
  const brief = JSON.parse(readFileSync(`${root}data/daybrief.json`, 'utf8')) as DayBrief;
  const noonMs = brief.dayStartMs + 12 * HOUR_MS;
  const entry = toHistoryEntry(assess(brief, noonMs));
  const path = `${root}data/history.json`;
  const history = parseHistory(existsSync(path) ? readFileSync(path, 'utf8') : null);
  upsertDay(history, brief.date, entry);
  writeFileSync(path, JSON.stringify(history, null, 2) + '\n');
  console.log(`snapshotted ${brief.date}: ${entry.verdict.text} (score ${entry.score})`);
} catch (err) {
  console.warn('WARN: snapshot failed, history unchanged:', err);
}
```

Add the script to `package.json` — the `scripts` block becomes:

```json
  "scripts": {
    "test": "vitest run",
    "fetch": "tsx src/build/fetch.ts",
    "compile": "tsx src/build/compile.ts",
    "snapshot": "tsx src/build/snapshot.ts",
    "build": "npm run compile && tsx src/build/render.ts"
  },
```

- [ ] **Step 2: Verify the script end-to-end**

```bash
npm run compile && npm run snapshot && npm run snapshot
```

Expected: `snapshotted <today>: <verdict> (score <n>)` printed twice; `data/history.json` exists and contains exactly one key under `days` (today's date) — run `cat data/history.json` to confirm the shape matches the spec.

Then verify the never-fail property: `mv data/daybrief.json /tmp/db.json && npm run snapshot; echo "exit=$?"` — expected `WARN: snapshot failed...` and `exit=0`. Restore: `mv /tmp/db.json data/daybrief.json`.

- [ ] **Step 3: Add workflow steps**

In `.github/workflows/daily.yml`, insert two steps between the `npm run fetch` step and the "Commit refreshed data" step:

```yaml
      - run: npm run compile
      - run: npm run snapshot
```

The existing commit step already does `git add data`, which picks up `history.json` and `daybrief.json`.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/build/snapshot.ts package.json .github/workflows/daily.yml data/history.json data/daybrief.json
git commit -m "Add daily snapshot: log noon-anchor assessment to data/history.json"
```

---

### Task 3: Day-level static render

**Files:**
- Modify: `src/build/render.ts`
- Modify: `src/site/index.html` (footer line)

**Interfaces:**
- Consumes: `HOUR_MS` from `src/lib/time.ts`.
- Produces: `web/index.html` whose footer reads "report for {full date}"; `web/assets/history.json` copied from `data/history.json` (empty `{"days":{}}` when absent). Template placeholder `{{TIMESTAMP}}` is renamed `{{REPORT_DATE}}` — Task 7's `index.html` edits assume that name.

- [ ] **Step 1: Update `render.ts`**

In `src/build/render.ts`, make these exact changes:

Replace the import line

```ts
import { nyDateString } from '../lib/time';
```

with

```ts
import { HOUR_MS } from '../lib/time';
```

Replace the anchor block

```ts
// Anchor time-travel renders (compile --date != today) to the brief's own noon so a
// prerendered day-specific brief actually scores against its own signal windows.
// Same-day production builds are unaffected — they use the real current time.
const nowMs =
  nyDateString(Date.now()) === brief.date ? Date.now() : brief.dayStartMs + 12 * 3_600_000;
```

with

```ts
// The day's canonical verdict: always assess at the brief's own noon, so the
// page reports the day, not the time of day. Same anchor as the snapshot log.
const nowMs = brief.dayStartMs + 12 * HOUR_MS;
```

Replace the timestamp block

```ts
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
  timeStyle: 'short',
}).format(new Date());
```

with

```ts
const reportDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
}).format(new Date(nowMs));
```

Replace the template line

```ts
  .replace('{{TIMESTAMP}}', () => timestamp)
```

with

```ts
  .replace('{{REPORT_DATE}}', () => reportDate)
```

Add `existsSync` to the `node:fs` import and, after the `writeFileSync(`${root}web/index.html`, html);` line, add:

```ts
const historyPath = `${root}data/history.json`;
writeFileSync(
  `${root}web/assets/history.json`,
  existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : '{"days":{}}\n'
);
```

- [ ] **Step 2: Update the footer template**

In `src/site/index.html`, replace

```html
      <small id="updated">as of {{TIMESTAMP}}</small>
```

with

```html
      <small id="updated">report for {{REPORT_DATE}}</small>
```

- [ ] **Step 3: Verify the build**

```bash
npm run build && grep -o 'report for [^<]*' web/index.html && cat web/assets/history.json | head -3
```

Expected: `report for <full weekday, month day, year>` (no clock time), and `web/assets/history.json` contains today's entry (from Task 2's run).

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/build/render.ts src/site/index.html
git commit -m "Bake the noon-anchor day report; ship history.json to assets"
```

---

### Task 4: Remove live-clock assessment from the client

**Files:**
- Modify: `src/site/main.ts` (full replacement below)

**Interfaces:**
- Consumes: nothing new.
- Produces: a `main.ts` containing only theme handling — Tasks 5 and 7 extend this exact file. The client no longer imports `assess`, `breakdownHtml`, or `nyDateString`, and the `STALE` constant, `render()`, and the 60-second interval are gone. Note: `main.ts` currently overwrites `#updated` with a live timestamp every render — removing `render()` is what makes Task 3's baked "report for" line stick.

- [ ] **Step 1: Replace `src/site/main.ts` with:**

```ts
import { coerceTheme, themeClass, THEME_STORAGE_KEY, type Theme } from './theme';

function loadTheme(): Theme {
  try {
    return coerceTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return coerceTheme(null);
  }
}

let theme = loadTheme();

function setTheme(next: Theme): void {
  theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private browsing or blocked storage — the choice just won't persist.
  }
  applyTheme();
}

function applyTheme(): void {
  const html = document.documentElement;
  const ready = html.classList.contains('ready');
  html.className = themeClass(theme) + (ready ? ' ready' : '');
  document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });
}

document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
  button.addEventListener('click', () => setTheme(coerceTheme(button.dataset.theme)));
});

applyTheme();

// Arm the crossfade only after the first frame has painted, so theme and
// verdict colors can never animate in during page load.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
});
```

- [ ] **Step 2: Verify the build and page**

```bash
npm run build && python3 -m http.server -d web 8080 &
```

Open `http://localhost:8080`: verdict/breakdown render from the baked HTML, theme buttons still switch and persist across reload, footer shows "report for {date}" and is not overwritten. Then `kill %1`.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/site/main.ts
git commit -m "Client: drop live-clock assessment and stale fallback; page is the day's report"
```

---

### Task 5: Stale-day hint

**Files:**
- Create: `src/site/stale.ts`
- Modify: `src/site/index.html` (hint element), `src/site/main.ts` (wiring)
- Test: `tests/stale.test.ts`

**Interfaces:**
- Consumes: `nyDateString` from `src/lib/time.ts`.
- Produces: `staleHint(briefDate: string, nowMs: number): string | null` — null when the brief is current (or future); otherwise the hint sentence. Element id `stale-hint` in the footer.

- [ ] **Step 1: Write the failing tests**

Create `tests/stale.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { staleHint } from '../src/site/stale';
import { nyTimeToMs } from '../src/lib/time';

describe('staleHint', () => {
  it('returns null when the brief is for today', () => {
    expect(staleHint('2026-08-08', nyTimeToMs('2026-08-08', 9, 0))).toBeNull();
  });

  it('returns null just before NY midnight', () => {
    expect(staleHint('2026-08-08', nyTimeToMs('2026-08-08', 23, 59))).toBeNull();
  });

  it("names the brief's weekday once the visitor's NY date is ahead", () => {
    // 2026-08-07 was a Friday.
    expect(staleHint('2026-08-07', nyTimeToMs('2026-08-08', 0, 5))).toBe(
      "Today's report hasn't landed yet — this is Friday's."
    );
  });

  it('handles multi-day gaps the same way', () => {
    expect(staleHint('2026-08-05', nyTimeToMs('2026-08-08', 12, 0))).toBe(
      "Today's report hasn't landed yet — this is Wednesday's."
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/stale.test.ts`
Expected: FAIL — cannot resolve `../src/site/stale`.

- [ ] **Step 3: Write the implementation**

Create `src/site/stale.ts`:

```ts
import { nyDateString } from '../lib/time';

/** Non-null when the visitor's NY date is ahead of the brief's date. */
export function staleHint(briefDate: string, nowMs: number): string | null {
  if (nyDateString(nowMs) <= briefDate) return null;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(new Date(`${briefDate}T12:00:00Z`));
  return `Today's report hasn't landed yet — this is ${weekday}'s.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Wire it into the page**

In `src/site/index.html`, directly under the `<small id="updated">` line, add:

```html
      <small class="stale-hint" id="stale-hint" hidden></small>
```

In `src/site/main.ts`, add to the imports:

```ts
import brief from '../../data/daybrief.json';
import { staleHint } from './stale';
import type { DayBrief } from '../engine/types';
```

and after the `applyTheme();` call (before the `requestAnimationFrame` block), add:

```ts
const dayBrief = brief as unknown as DayBrief;

const hintEl = document.getElementById('stale-hint') as HTMLElement;
function updateHint(): void {
  const hint = staleHint(dayBrief.date, Date.now());
  hintEl.textContent = hint ?? '';
  hintEl.hidden = hint === null;
}
updateHint();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateHint();
});
```

In `src/site/styles.css`, after the `footer small` rule (line ~93, `footer small { ... }`), add:

```css
.stale-hint { display: block; margin-top: 0.35rem; opacity: 0.8; }
```

- [ ] **Step 6: Verify in the browser**

```bash
npm run build && python3 -m http.server -d web 8080 &
```

Open `http://localhost:8080` — no hint visible today. In devtools console, confirm the element exists: `document.getElementById('stale-hint')`. (The positive case is covered by the unit tests; forcing it live would need a stale brief.) Then `kill %1`.

- [ ] **Step 7: Commit**

```bash
git add src/site/stale.ts tests/stale.test.ts src/site/index.html src/site/main.ts src/site/styles.css
git commit -m "Show a quiet hint when the visitor's day is ahead of the report"
```

---

### Task 6: Calendar module (pure logic + HTML builders)

**Files:**
- Create: `src/site/calendar.ts`
- Modify: `src/site/breakdown.ts` (loosen `breakdownHtml` input type)
- Test: `tests/calendar.test.ts`

**Interfaces:**
- Consumes: `HistoryEntry` from `src/lib/history.ts` (Task 1); `escapeHtml`, `breakdownHtml` from `src/site/breakdown.ts`.
- Produces (Task 7 relies on these exact names):
  - `monthGrid(year: number, month: number): (string | null)[][]` — Monday-first weeks of `YYYY-MM-DD` strings, `null` for padding; `month` is 1–12.
  - `monthLabel(year: number, month: number): string` — e.g. `"August 2026"`.
  - `shiftMonth(year: number, month: number, delta: number): { year: number; month: number }`
  - `monthKey(date: string): string` — `"YYYY-MM"`.
  - `calendarHtml(days: Record<string, HistoryEntry>, year: number, month: number, selected: string | null): string`
  - `dayDetailHtml(date: string, entry: HistoryEntry): string`
  - In `breakdown.ts`: `interface BreakdownView { verdict: { text: string }; score: number; signals: { label: string; contribution: number }[] }` and `breakdownHtml(a: BreakdownView)`. `Assessment` satisfies `BreakdownView` structurally, so existing callers compile unchanged.

- [ ] **Step 1: Loosen `breakdownHtml`'s input type**

In `src/site/breakdown.ts`, replace

```ts
import type { Assessment } from '../engine/types';
```

with

```ts
export interface BreakdownView {
  verdict: { text: string };
  score: number;
  signals: { label: string; contribution: number }[];
}
```

and change the signature

```ts
export function breakdownHtml(a: Assessment): string {
```

to

```ts
export function breakdownHtml(a: BreakdownView): string {
```

Run: `npm test` — expected: all tests PASS (existing breakdown tests pass `Assessment`-shaped objects, which satisfy `BreakdownView`).

- [ ] **Step 2: Write the failing tests**

Create `tests/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  monthGrid, monthLabel, shiftMonth, monthKey, calendarHtml, dayDetailHtml,
} from '../src/site/calendar';
import type { HistoryEntry } from '../src/lib/history';

const entry: HistoryEntry = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    { id: 'weekend-baseline', label: 'Weekend', contribution: 10, reason: 'w' },
  ],
};

describe('monthGrid', () => {
  it('lays out August 2026 Monday-first (Aug 1 2026 is a Saturday)', () => {
    const weeks = monthGrid(2026, 8);
    expect(weeks[0]).toEqual([null, null, null, null, null, '2026-08-01', '2026-08-02']);
    expect(weeks.at(-1)).toEqual(['2026-08-31', null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('handles a month starting on Monday with no leading padding', () => {
    // June 1 2026 is a Monday.
    expect(monthGrid(2026, 6)[0][0]).toBe('2026-06-01');
  });

  it('lays out the DST-transition month correctly (Nov 2026, 30 days)', () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    // Nov 1 2026 is a Sunday — last cell of the first week.
    expect(weeks[0][6]).toBe('2026-11-01');
  });

  it('every week has exactly 7 cells', () => {
    for (const m of [1, 2, 6, 8, 11, 12]) {
      for (const week of monthGrid(2026, m)) expect(week).toHaveLength(7);
    }
  });
});

describe('month navigation helpers', () => {
  it('labels a month', () => {
    expect(monthLabel(2026, 8)).toBe('August 2026');
  });

  it('shifts across year boundaries both ways', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('extracts a month key from a date', () => {
    expect(monthKey('2026-08-08')).toBe('2026-08');
  });
});

describe('calendarHtml', () => {
  const days = { '2026-08-08': entry };

  it('renders logged days as level-tinted buttons with a data-date', () => {
    const html = calendarHtml(days, 2026, 8, null);
    expect(html).toContain('data-date="2026-08-08"');
    expect(html).toContain('lvl-4');
  });

  it('renders unlogged days as inert cells and marks the selected day', () => {
    const html = calendarHtml(days, 2026, 8, '2026-08-08');
    expect(html).toContain('cal-selected');
    expect(html).toContain('<span class="cal-cell cal-blank">7</span>');
    expect(html).not.toContain('data-date="2026-08-07"');
  });
});

describe('dayDetailHtml', () => {
  it('shows the date, verdict, headline, and breakdown', () => {
    const html = dayDetailHtml('2026-08-08', entry);
    expect(html).toContain('Saturday, August 8, 2026');
    expect(html).toContain('No');
    expect(html).toContain('anything can happen');
    expect(html).toContain('Weekend');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/calendar.test.ts`
Expected: FAIL — cannot resolve `../src/site/calendar`.

- [ ] **Step 4: Write the implementation**

Create `src/site/calendar.ts`:

```ts
import type { HistoryEntry } from '../lib/history';
import { breakdownHtml, escapeHtml } from './breakdown';

/** Monday-first weeks for a month; null cells pad the edges. month is 1-12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const mm = String(month).padStart(2, '0');
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const m = month - 1 + delta;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function calendarHtml(
  days: Record<string, HistoryEntry>,
  year: number,
  month: number,
  selected: string | null
): string {
  const head = DOW.map((d) => `<span class="cal-dow">${d}</span>`).join('');
  const cells = monthGrid(year, month)
    .flat()
    .map((date) => {
      if (!date) return '<span class="cal-cell cal-empty"></span>';
      const day = Number(date.slice(8));
      const entry = days[date];
      if (!entry) return `<span class="cal-cell cal-blank">${day}</span>`;
      const sel = date === selected ? ' cal-selected' : '';
      return (
        `<button class="cal-cell cal-day lvl-${entry.verdict.level}${sel}" ` +
        `data-date="${date}" title="${escapeHtml(entry.verdict.text)}">${day}</button>`
      );
    })
    .join('');
  return `<div class="cal-grid">${head}${cells}</div>`;
}

export function dayDetailHtml(date: string, entry: HistoryEntry): string {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', dateStyle: 'full',
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    `<h2>${escapeHtml(label)} — ${escapeHtml(entry.verdict.text)}</h2>` +
    `<p class="reason">${escapeHtml(entry.headline)}</p>` +
    breakdownHtml(entry)
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/site/calendar.ts tests/calendar.test.ts src/site/breakdown.ts
git commit -m "Add calendar module: month grid, nav helpers, cell and detail HTML"
```

---

### Task 7: Calendar UI — markup, styles, client wiring

**Files:**
- Modify: `src/site/index.html`, `src/site/styles.css`, `src/site/main.ts` (full replacement below)

**Interfaces:**
- Consumes: everything Task 6 produces; `parseHistory`/`HistoryFile` from Task 1; `nyDateString` from `src/lib/time.ts`; element ids `history-toggle`, `history`, `cal-prev`, `cal-next`, `cal-title`, `cal-grid`, `cal-detail`.
- Produces: the user-facing feature; no downstream consumers.

- [ ] **Step 1: Add markup**

In `src/site/index.html`, inside `<footer>`, after the `</div>` that closes `id="themes"`, add:

```html
      <button class="history-link" id="history-toggle" aria-expanded="false">history</button>
```

Then after `</footer>` (still inside `<main>`), add:

```html
    <section class="history" id="history" hidden>
      <div class="cal-nav">
        <button id="cal-prev" aria-label="Previous month">◀</button>
        <span id="cal-title"></span>
        <button id="cal-next" aria-label="Next month">▶</button>
      </div>
      <div id="cal-grid"></div>
      <div id="cal-detail"></div>
    </section>
```

- [ ] **Step 2: Refactor level colors into custom properties and style the calendar**

In `src/site/styles.css`, the three theme blocks (lines ~24–45) currently repeat `html.theme-X body.level-N { background: …; }` eighteen times. Replace them with custom properties plus six shared rules — **keep the hex values exactly as they are today**:

```css
html.theme-jewel {
  --lvl-1: #065f46; --lvl-2: #155e75; --lvl-3: #5b21b6;
  --lvl-4: #9d174d; --lvl-5: #991b1b; --lvl-6: #450a0a;
}
html.theme-twilight {
  --lvl-1: #2563eb; --lvl-2: #4f46e5; --lvl-3: #7c3aed;
  --lvl-4: #a21caf; --lvl-5: #be185d; --lvl-6: #881337;
}
html.theme-soft {
  --lvl-1: #a7f3d0; --lvl-2: #bae6fd; --lvl-3: #fde68a;
  --lvl-4: #fed7aa; --lvl-5: #fda4af; --lvl-6: #f43f5e;
}
body.level-1 { background: var(--lvl-1); }
body.level-2 { background: var(--lvl-2); }
body.level-3 { background: var(--lvl-3); }
body.level-4 { background: var(--lvl-4); }
body.level-5 { background: var(--lvl-5); }
body.level-6 { background: var(--lvl-6); }
```

Preserve the existing `html.theme-soft` ink/line overrides and the `html.theme-soft body.level-6` override block untouched. Then append calendar styles at the end of the file:

```css
.history-link {
  background: none; border: none; color: inherit; font: inherit;
  cursor: pointer; opacity: 0.7; border-bottom: 1px dotted var(--underline);
  padding: 0;
}
.history-link:hover { opacity: 1; }

.history { margin-top: 1.5rem; }
.cal-nav {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; margin-bottom: 0.75rem;
}
.cal-nav button {
  background: none; border: none; color: inherit; font: inherit;
  cursor: pointer; opacity: 0.7;
}
.cal-nav button:disabled { opacity: 0.2; cursor: default; }

.cal-grid {
  display: grid; grid-template-columns: repeat(7, 2.2rem);
  gap: 0.25rem; justify-content: center;
}
.cal-dow { font-size: 0.7rem; opacity: 0.6; text-align: center; }
.cal-cell {
  height: 2.2rem; display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; border-radius: 0.35rem; border: none; color: inherit;
}
.cal-blank { opacity: 0.35; }
.cal-day { cursor: pointer; border: 2px solid transparent; }
.cal-day.lvl-1 { background: var(--lvl-1); }
.cal-day.lvl-2 { background: var(--lvl-2); }
.cal-day.lvl-3 { background: var(--lvl-3); }
.cal-day.lvl-4 { background: var(--lvl-4); }
.cal-day.lvl-5 { background: var(--lvl-5); }
.cal-day.lvl-6 { background: var(--lvl-6); }
.cal-day.cal-selected { border-color: var(--underline); }

.cal-detail-panel { margin-top: 1rem; }
.cal-detail-panel h2 { font-size: 1rem; margin-bottom: 0.25rem; }
```

Note: calendar cells sit on the page background (which is itself a `--lvl-*` color), so same-level cells blend in — the 2px transparent border plus the distinct cell radius keeps them legible; verify visually in Step 4.

- [ ] **Step 3: Replace `src/site/main.ts` with the final client**

```ts
import brief from '../../data/daybrief.json';
import { coerceTheme, themeClass, THEME_STORAGE_KEY, type Theme } from './theme';
import { staleHint } from './stale';
import {
  calendarHtml, dayDetailHtml, monthKey, monthLabel, shiftMonth,
} from './calendar';
import { parseHistory, type HistoryFile } from '../lib/history';
import { nyDateString } from '../lib/time';
import type { DayBrief } from '../engine/types';

const dayBrief = brief as unknown as DayBrief;

// --- Theme -----------------------------------------------------------------

function loadTheme(): Theme {
  try {
    return coerceTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return coerceTheme(null);
  }
}

let theme = loadTheme();

function setTheme(next: Theme): void {
  theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private browsing or blocked storage — the choice just won't persist.
  }
  applyTheme();
}

function applyTheme(): void {
  const html = document.documentElement;
  const ready = html.classList.contains('ready');
  html.className = themeClass(theme) + (ready ? ' ready' : '');
  document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });
}

document.querySelectorAll<HTMLButtonElement>('#themes button').forEach((button) => {
  button.addEventListener('click', () => setTheme(coerceTheme(button.dataset.theme)));
});

applyTheme();

// --- Stale hint ------------------------------------------------------------

const hintEl = document.getElementById('stale-hint') as HTMLElement;
function updateHint(): void {
  const hint = staleHint(dayBrief.date, Date.now());
  hintEl.textContent = hint ?? '';
  hintEl.hidden = hint === null;
}
updateHint();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateHint();
});

// --- History calendar ------------------------------------------------------

const section = document.getElementById('history') as HTMLElement;
const toggleBtn = document.getElementById('history-toggle') as HTMLButtonElement;
const titleEl = document.getElementById('cal-title') as HTMLElement;
const gridEl = document.getElementById('cal-grid') as HTMLElement;
const detailEl = document.getElementById('cal-detail') as HTMLElement;
const prevBtn = document.getElementById('cal-prev') as HTMLButtonElement;
const nextBtn = document.getElementById('cal-next') as HTMLButtonElement;

let history: HistoryFile | null = null;
let selected: string | null = null;
const today = () => nyDateString(Date.now());
let view = { year: Number(today().slice(0, 4)), month: Number(today().slice(5, 7)) };

function viewKey(): string {
  return `${view.year}-${String(view.month).padStart(2, '0')}`;
}

function renderCalendar(): void {
  if (!history) return;
  const dates = Object.keys(history.days).sort();
  const earliest = dates.length ? monthKey(dates[0]) : monthKey(today());
  const latest = monthKey(today());
  titleEl.textContent = monthLabel(view.year, view.month);
  gridEl.innerHTML = calendarHtml(history.days, view.year, view.month, selected);
  prevBtn.disabled = viewKey() <= earliest;
  nextBtn.disabled = viewKey() >= latest;
  const entry = selected ? history.days[selected] : undefined;
  detailEl.innerHTML =
    selected && entry
      ? `<div class="cal-detail-panel">${dayDetailHtml(selected, entry)}</div>`
      : '';
}

async function openHistory(): Promise<void> {
  if (!history) {
    try {
      const res = await fetch('/assets/history.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      history = parseHistory(await res.text());
    } catch {
      gridEl.innerHTML = '<p class="math">history unavailable</p>';
      return;
    }
  }
  renderCalendar();
}

toggleBtn.addEventListener('click', () => {
  const opening = section.hidden;
  section.hidden = !opening;
  toggleBtn.setAttribute('aria-expanded', String(opening));
  if (opening) void openHistory();
});

prevBtn.addEventListener('click', () => {
  view = shiftMonth(view.year, view.month, -1);
  renderCalendar();
});

nextBtn.addEventListener('click', () => {
  view = shiftMonth(view.year, view.month, 1);
  renderCalendar();
});

gridEl.addEventListener('click', (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cal-day');
  if (!cell?.dataset.date) return;
  selected = selected === cell.dataset.date ? null : cell.dataset.date;
  renderCalendar();
});

// Arm the crossfade only after the first frame has painted, so theme and
// verdict colors can never animate in during page load.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.documentElement.classList.add('ready'));
});
```

- [ ] **Step 4: Verify in the browser**

```bash
npm test && npm run build && python3 -m http.server -d web 8080 &
```

Open `http://localhost:8080` and check:
1. "history" link visible near the theme dots; clicking expands the calendar showing the current month with today's cell tinted.
2. Clicking today's cell opens the detail panel with date, verdict, headline, and signal rows; clicking again closes it.
3. Prev/next arrows are both disabled (only one logged month exists).
4. All three themes: cells re-tint, page backgrounds unchanged from before the CSS refactor (compare the six `level-*` colors per theme against the hex values in Step 2).
5. Reload with devtools network offline for `/assets/history.json` (block the URL) → "history unavailable" appears, page otherwise fine.

Then `kill %1`.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/site/index.html src/site/styles.css src/site/main.ts
git commit -m "History calendar: month grid behind a history link, day detail panel"
```

---

## Final verification (after all tasks)

- [ ] `npm test` — full suite green.
- [ ] `npm run compile && npm run snapshot && npm run build` — clean output; `web/index.html` shows the day report; `web/assets/history.json` has today.
- [ ] `git log --oneline` — one commit per task; working tree clean aside from regenerated `data/*.json` build artifacts (leave those for the daily workflow to commit).
- [ ] Do NOT push — the user pushes when ready (push triggers the workflow).

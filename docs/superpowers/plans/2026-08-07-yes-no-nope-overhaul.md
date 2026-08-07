# Yes/No/Nope Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ismikeworking.com as a static, time-of-day-live "Is Mike working?" verdict site driven by a weighted rule engine (TypeScript), deployable on Render's free static tier with GitHub Actions as the daily data cron.

**Architecture:** A daily GitHub Action fetches football fixtures (TheSportsDB) and weather (Open-Meteo) into committed `data/*.json`; the push triggers Render's static build, which compiles a "day brief" JSON and prerenders `web/index.html`. The same rule engine is bundled to the client, which re-evaluates the verdict every minute against the visitor's clock in America/New_York.

**Tech Stack:** Node 22, TypeScript, esbuild (client bundle), tsx (script runner), Vitest (tests). No framework.

## Global Constraints

- All time evaluation in **America/New_York** (spec: Constraints).
- Weather location: **West Chester, PA** — lat 39.9607, lon −75.6055 (spec: Constraints).
- Render free tier: static site only; publish directory `web/`; build command `npm ci && npm run build` (spec: Architecture).
- Verdict ladder (spec: Verdict ladder): score ≥ +50 → "Yes." (level 1) · +20…+49 → "Probably" (2) · −19…+19 → "Hmm… maybe?" (3) · −49…−20 → "No" (4) · −79…−50 → "Nope" (5) · ≤ −80 or hard override → "NO WAY" (6).
- Big teams list: Liverpool, Man City, Arsenal, Man United, Chelsea, Tottenham (spec: Starter rule set).
- Keep existing favicons in `web/`; git history preserves deleted PHP (spec: Migration).
- ESM throughout (`"type": "module"`).

---

### Task 1: Scaffold the Node project and remove the legacy PHP

**Files:**
- Create: `package.json`, `tsconfig.json`, `tests/sanity.test.ts`
- Modify: `.gitignore`
- Delete: `compile.php`, `download.php`, `template.phtml`, `src/Common.php`, `src/Compiler.php`, `src/Download.php`, `src/weather.php`, `v1/` (entire dir), `data/` contents (all old JSON incl. `original/`, `backup/`), `docs/rules_v1.txt`, `docs/example_event.json`, `web/archive/`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `test`, `fetch`, `compile`, `build` used by all later tasks; tsconfig with `resolveJsonModule` and `strict`.

- [ ] **Step 1: Write package.json and tsconfig.json**

`package.json`:

```json
{
  "name": "ismikeworking",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "fetch": "tsx src/build/fetch.ts",
    "compile": "tsx src/build/compile.ts",
    "build": "npm run compile && tsx src/build/render.ts"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install --save-dev typescript tsx esbuild vitest @types/node`
Expected: `package-lock.json` created, no errors.

- [ ] **Step 3: Write a sanity test**

`tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs TypeScript tests', () => {
    const answer: number = 42;
    expect(answer).toBe(42);
  });
});
```

- [ ] **Step 4: Run tests to verify the toolchain works**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Delete legacy files and update .gitignore**

```bash
git rm -r compile.php download.php template.phtml src/Common.php src/Compiler.php src/Download.php src/weather.php v1 docs/rules_v1.txt docs/example_event.json web/archive
git rm -r 'data/*'
```

Replace `.gitignore` contents with:

```
node_modules/
web/index.html
web/assets/
data/daybrief.json
.superpowers/
```

Then `mkdir -p data && touch data/.gitkeep && git add data/.gitkeep`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript project, remove legacy PHP"
```

---

### Task 2: America/New_York time helpers

**Files:**
- Create: `src/lib/time.ts`
- Test: `tests/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `nyParts(ms: number): { year: number; month: number; day: number; hour: number; minute: number; weekday: number }` (weekday 1=Mon…7=Sun)
  - `nyDateString(ms: number): string` — `YYYY-MM-DD` in NY
  - `nyTimeToMs(date: string, hour?: number, minute?: number): number` — epoch ms of a NY wall-clock time (DST-safe)
  - `nextDateString(date: string): string`
  - `dayBounds(date: string): { startMs: number; endMs: number }`
  - `HOUR_MS` constant (3600000)

- [ ] **Step 1: Write the failing tests**

`tests/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nyParts, nyDateString, nyTimeToMs, nextDateString, dayBounds, HOUR_MS } from '../src/lib/time';

describe('time helpers', () => {
  it('converts NY wall clock to epoch during EDT', () => {
    // 2026-08-07 15:00 EDT is 19:00 UTC
    expect(nyTimeToMs('2026-08-07', 15, 0)).toBe(Date.parse('2026-08-07T19:00:00Z'));
  });

  it('converts NY wall clock to epoch during EST', () => {
    // 2026-01-15 15:00 EST is 20:00 UTC
    expect(nyTimeToMs('2026-01-15', 15, 0)).toBe(Date.parse('2026-01-15T20:00:00Z'));
  });

  it('round-trips parts and date strings', () => {
    const ms = nyTimeToMs('2026-08-07', 23, 30);
    const p = nyParts(ms);
    expect(p).toMatchObject({ year: 2026, month: 8, day: 7, hour: 23, minute: 30 });
    expect(p.weekday).toBe(5); // Friday
    expect(nyDateString(ms)).toBe('2026-08-07');
  });

  it('computes next date across month end', () => {
    expect(nextDateString('2026-08-31')).toBe('2026-09-01');
  });

  it('computes day bounds spanning 24h (non-DST day)', () => {
    const b = dayBounds('2026-08-07');
    expect(b.endMs - b.startMs).toBe(24 * HOUR_MS);
    expect(nyDateString(b.startMs)).toBe('2026-08-07');
    expect(nyDateString(b.endMs)).toBe('2026-08-08');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/time.test.ts`
Expected: FAIL — cannot resolve `../src/lib/time`.

- [ ] **Step 3: Implement src/lib/time.ts**

```ts
const NY = 'America/New_York';

export const HOUR_MS = 3_600_000;

const WEEKDAYS: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: NY,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
  weekday: 'short',
});

export function nyParts(ms: number) {
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24, // Intl may emit "24" at midnight
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

export function nyDateString(ms: number): string {
  const p = nyParts(ms);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** Epoch ms for a wall-clock time in NY. NY offset is always UTC-4 or UTC-5. */
export function nyTimeToMs(date: string, hour = 0, minute = 0): number {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const utcGuess = Date.parse(`${date}T${hh}:${mm}:00Z`);
  for (const offsetHours of [4, 5]) {
    const candidate = utcGuess + offsetHours * HOUR_MS;
    const p = nyParts(candidate);
    if (p.hour === hour && p.minute === minute && nyDateString(candidate) === date) {
      return candidate;
    }
  }
  return utcGuess + 5 * HOUR_MS;
}

export function nextDateString(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dayBounds(date: string): { startMs: number; endMs: number } {
  return {
    startMs: nyTimeToMs(date, 0, 0),
    endMs: nyTimeToMs(nextDateString(date), 0, 0),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/time.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/time.ts tests/time.test.ts
git commit -m "feat: America/New_York time helpers"
```

---

### Task 3: Engine types and the verdict ladder

**Files:**
- Create: `src/engine/types.ts`, `src/engine/verdicts.ts`
- Test: `tests/verdicts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later engine task):

```ts
// src/engine/types.ts — exact shapes
export type VerdictText = 'Yes.' | 'Probably' | 'Hmm… maybe?' | 'No' | 'Nope' | 'NO WAY';
export interface Verdict { text: VerdictText; level: 1 | 2 | 3 | 4 | 5 | 6 }
export interface TimeWindow { startMs: number; endMs: number }
export interface Signal {
  id: string;
  label: string;
  weight: number;       // signed: positive = working, negative = not working
  confidence: number;   // 0..1
  window: TimeWindow;
  reason: string;
  hardOverride?: VerdictText;
}
export interface Match {
  competition: 'PL' | 'CL' | 'EL';
  home: string;
  away: string;
  kickoffMs: number | null;
  round: string;
  isFinal: boolean;
  isKnockout: boolean;
}
export interface WeatherDay { date: string; highF: number; precipProb: number }
export interface PersonalHoliday { title: string; reason: string; weight: number; hardOverride?: VerdictText }
export interface LiturgicalDay {
  name: string;
  dayOff: boolean;                                   // school gives the day off
  familyDay?: { weight: number; reason: string };    // e.g. Easter Sunday
}
export interface DayBrief {
  date: string;          // YYYY-MM-DD (NY)
  weekday: number;       // 1=Mon…7=Sun
  dayStartMs: number;
  dayEndMs: number;
  inSchoolTerm: boolean; // date falls inside a school term, vacations excluded
  schoolDay: boolean;    // teaching day: weekday && inSchoolTerm && !liturgical day off
  matches: Match[];
  weather: WeatherDay | null;
  liturgical: LiturgicalDay | null;
  personal: PersonalHoliday | null;
  generatedAtMs: number;
}
export type Rule = (brief: DayBrief) => Signal[];
export interface ActiveSignal extends Signal { contribution: number }
export interface Assessment {
  verdict: Verdict;
  score: number;
  headline: string;
  signals: ActiveSignal[];
}
```

  - `src/engine/verdicts.ts`: `scoreToVerdict(score: number): Verdict`, `verdictByText(text: VerdictText): Verdict`, `LADDER` table.

- [ ] **Step 1: Write the failing tests**

`tests/verdicts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreToVerdict, verdictByText } from '../src/engine/verdicts';

describe('verdict ladder', () => {
  it.each([
    [80, 'Yes.', 1],
    [50, 'Yes.', 1],
    [49, 'Probably', 2],
    [20, 'Probably', 2],
    [19, 'Hmm… maybe?', 3],
    [0, 'Hmm… maybe?', 3],
    [-19, 'Hmm… maybe?', 3],
    [-20, 'No', 4],
    [-49, 'No', 4],
    [-50, 'Nope', 5],
    [-79, 'Nope', 5],
    [-80, 'NO WAY', 6],
    [-200, 'NO WAY', 6],
  ])('maps score %i to %s (level %i)', (score, text, level) => {
    expect(scoreToVerdict(score)).toEqual({ text, level });
  });

  it('looks up a verdict by text', () => {
    expect(verdictByText('NO WAY')).toEqual({ text: 'NO WAY', level: 6 });
    expect(verdictByText('Yes.')).toEqual({ text: 'Yes.', level: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/verdicts.test.ts`
Expected: FAIL — cannot resolve `../src/engine/verdicts`.

- [ ] **Step 3: Implement types.ts (exactly as in Interfaces above) and verdicts.ts**

`src/engine/verdicts.ts`:

```ts
import type { Verdict, VerdictText } from './types';

interface Rung { min: number; text: VerdictText; level: Verdict['level'] }

export const LADDER: Rung[] = [
  { min: 50, text: 'Yes.', level: 1 },
  { min: 20, text: 'Probably', level: 2 },
  { min: -19, text: 'Hmm… maybe?', level: 3 },
  { min: -49, text: 'No', level: 4 },
  { min: -79, text: 'Nope', level: 5 },
  { min: -Infinity, text: 'NO WAY', level: 6 },
];

export function scoreToVerdict(score: number): Verdict {
  for (const rung of LADDER) {
    if (score >= rung.min) return { text: rung.text, level: rung.level };
  }
  return { text: 'NO WAY', level: 6 };
}

export function verdictByText(text: VerdictText): Verdict {
  const rung = LADDER.find((r) => r.text === text)!;
  return { text: rung.text, level: rung.level };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/verdicts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/verdicts.ts tests/verdicts.test.ts
git commit -m "feat: engine types and verdict ladder"
```

---

### Task 4: The combiner

**Files:**
- Create: `src/engine/combine.ts`
- Test: `tests/combine.test.ts`

**Interfaces:**
- Consumes: `Signal`, `ActiveSignal`, `Assessment` from `src/engine/types`; `scoreToVerdict`, `verdictByText` from `src/engine/verdicts`.
- Produces: `combine(signals: Signal[], nowMs: number): Assessment` — filters signals to those whose window contains `nowMs`, sums `round(weight × confidence)`, applies hard-override precedence (largest |weight| override wins), headline = reason of the largest-|contribution| active signal (override signal's reason when an override fires), fallback headline `'No data, no opinion.'`.

- [ ] **Step 1: Write the failing tests**

`tests/combine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { combine } from '../src/engine/combine';
import type { Signal } from '../src/engine/types';

function sig(over: Partial<Signal>): Signal {
  return {
    id: 'test',
    label: 'Test',
    weight: 10,
    confidence: 1,
    window: { startMs: 0, endMs: 100 },
    reason: 'test reason',
    ...over,
  };
}

describe('combine', () => {
  it('sums weight × confidence for active signals only', () => {
    const a = combine(
      [
        sig({ id: 'a', weight: 40 }),
        sig({ id: 'b', weight: -30, confidence: 0.5 }),
        sig({ id: 'c', weight: 99, window: { startMs: 200, endMs: 300 } }),
      ],
      50
    );
    expect(a.score).toBe(25); // 40 + (-15); c inactive
    expect(a.verdict.text).toBe('Probably');
    expect(a.signals.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('headline comes from the strongest active signal', () => {
    const a = combine(
      [sig({ id: 'weak', weight: 10, reason: 'weak' }), sig({ id: 'strong', weight: -60, reason: 'strong' })],
      50
    );
    expect(a.headline).toBe('strong');
    expect(a.verdict.text).toBe('Nope'); // 10 - 60 = -50
  });

  it('hard override pins the verdict and headline regardless of score', () => {
    const a = combine(
      [
        sig({ id: 'pos', weight: 100, reason: 'very yes' }),
        sig({ id: 'lfc', weight: -95, reason: 'Liverpool are playing', hardOverride: 'NO WAY' }),
      ],
      50
    );
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toBe('Liverpool are playing');
  });

  it('largest |weight| override wins when several fire', () => {
    const a = combine(
      [
        sig({ id: 'small', weight: -50, reason: 'small', hardOverride: 'Nope' }),
        sig({ id: 'big', weight: -100, reason: 'big', hardOverride: 'NO WAY' }),
      ],
      50
    );
    expect(a.verdict.text).toBe('NO WAY');
  });

  it('inactive hard overrides are ignored', () => {
    const a = combine([sig({ hardOverride: 'NO WAY', window: { startMs: 200, endMs: 300 } })], 50);
    expect(a.verdict.text).toBe('Hmm… maybe?');
    expect(a.headline).toBe('No data, no opinion.');
  });

  it('window end is exclusive', () => {
    const a = combine([sig({ window: { startMs: 0, endMs: 100 } })], 100);
    expect(a.signals).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/combine.test.ts`
Expected: FAIL — cannot resolve `../src/engine/combine`.

- [ ] **Step 3: Implement src/engine/combine.ts**

```ts
import type { ActiveSignal, Assessment, Signal } from './types';
import { scoreToVerdict, verdictByText } from './verdicts';

export function combine(signals: Signal[], nowMs: number): Assessment {
  const active: ActiveSignal[] = signals
    .filter((s) => nowMs >= s.window.startMs && nowMs < s.window.endMs)
    .map((s) => ({ ...s, contribution: Math.round(s.weight * s.confidence) }));

  const score = active.reduce((sum, s) => sum + s.contribution, 0);

  const byStrength = [...active].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  let verdict = scoreToVerdict(score);
  let headlineSignal: ActiveSignal | undefined = byStrength[0];

  const overrides = active.filter((s) => s.hardOverride);
  if (overrides.length > 0) {
    const top = overrides.reduce((a, b) =>
      Math.abs(b.weight) > Math.abs(a.weight) ? b : a
    );
    verdict = verdictByText(top.hardOverride!);
    headlineSignal = top;
  }

  return {
    verdict,
    score,
    headline: headlineSignal?.reason ?? 'No data, no opinion.',
    signals: active,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/combine.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/combine.ts tests/combine.test.ts
git commit -m "feat: signal combiner with hard-override precedence"
```

---

### Task 5: Test helper + baseline and school rules

**Files:**
- Create: `tests/helpers.ts`, `src/engine/rules/baseline.ts`, `src/engine/rules/school.ts`
- Test: `tests/rules-baseline-school.test.ts`

**Interfaces:**
- Consumes: `DayBrief`, `Rule`, `Signal` from `src/engine/types`; `dayBounds`, `nyParts`, `HOUR_MS` from `src/lib/time`.
- Produces:
  - `tests/helpers.ts`: `makeBrief(date: string, over?: Partial<DayBrief>): DayBrief` — every rule test uses this.
  - `baselineRule: Rule` and `schoolRule: Rule` (named exports).

Rule behavior (windows are NY wall-clock, expressed as offsets from `dayStartMs`; this plan treats an hour as `HOUR_MS` from day start, which is exact except on the two DST-change days — acceptable):

- `baselineRule`:
  - weekday (1–5) and `!schoolDay`: +35, window 9:00–23:00, id `no-school-project-day`, reason "No school today — a full project day at the desk."
  - weekend (6–7): +10, window 9:00–23:00, id `weekend-baseline`, reason "It's the weekend — anything can happen."
  - every day: −40, window 23:00–24:00, id `late-night`, reason "It's late. Mike should be asleep."
  - every day: −40, window 0:00–7:00, id `early-morning`, reason "Mike is asleep. Probably."
- `schoolRule` (only when `brief.schoolDay`):
  - −80, window 7:30–15:30, id `teaching`, reason "Mike is at school molding young minds."
  - +40, window 17:30–23:00, id `school-evening`, reason "School's out — prime project hours."

- [ ] **Step 1: Write the test helper**

`tests/helpers.ts`:

```ts
import type { DayBrief } from '../src/engine/types';
import { dayBounds, nyParts } from '../src/lib/time';

export function makeBrief(date: string, over: Partial<DayBrief> = {}): DayBrief {
  const { startMs, endMs } = dayBounds(date);
  return {
    date,
    weekday: nyParts(startMs + 12 * 3_600_000).weekday,
    dayStartMs: startMs,
    dayEndMs: endMs,
    inSchoolTerm: false,
    schoolDay: false,
    matches: [],
    weather: null,
    liturgical: null,
    personal: null,
    generatedAtMs: startMs,
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/rules-baseline-school.test.ts` (2026-08-07 is a Friday, 2026-08-08 a Saturday):

```ts
import { describe, it, expect } from 'vitest';
import { baselineRule } from '../src/engine/rules/baseline';
import { schoolRule } from '../src/engine/rules/school';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

describe('baselineRule', () => {
  it('non-school weekday daytime is a project day', () => {
    const brief = makeBrief('2026-08-07');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 14, 0));
    expect(a.score).toBe(35);
    expect(a.signals.map((s) => s.id)).toEqual(['no-school-project-day']);
  });

  it('weekend daytime is a weak yes', () => {
    const brief = makeBrief('2026-08-08');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-08', 14, 0));
    expect(a.score).toBe(10);
  });

  it('late night goes negative', () => {
    const brief = makeBrief('2026-08-07');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-07', 23, 30));
    expect(a.signals.map((s) => s.id)).toEqual(['late-night']);
    expect(a.score).toBe(-40);
  });

  it('early morning goes negative', () => {
    const brief = makeBrief('2026-08-08');
    const a = combine(baselineRule(brief), nyTimeToMs('2026-08-08', 3, 0));
    expect(a.signals.map((s) => s.id)).toEqual(['early-morning']);
  });

  it('emits nothing extra on a school day daytime', () => {
    const brief = makeBrief('2026-03-10', { inSchoolTerm: true, schoolDay: true });
    const a = combine(baselineRule(brief), nyTimeToMs('2026-03-10', 14, 0));
    expect(a.signals).toHaveLength(0);
  });
});

describe('schoolRule', () => {
  const brief = makeBrief('2026-03-10', { inSchoolTerm: true, schoolDay: true }); // a Tuesday

  it('teaching hours are a hard no-ish', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 10, 0));
    expect(a.score).toBe(-80);
    expect(a.verdict.text).toBe('NO WAY');
  });

  it('school evening is prime project time', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 19, 0));
    expect(a.score).toBe(40);
  });

  it('the gap between school and evening emits nothing', () => {
    const a = combine(schoolRule(brief), nyTimeToMs('2026-03-10', 16, 0));
    expect(a.signals).toHaveLength(0);
  });

  it('emits nothing when not a school day', () => {
    expect(schoolRule(makeBrief('2026-08-07'))).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/rules-baseline-school.test.ts`
Expected: FAIL — cannot resolve rule modules.

- [ ] **Step 4: Implement the rules**

`src/engine/rules/baseline.ts`:

```ts
import type { Rule, Signal } from '../types';
import { HOUR_MS } from '../../lib/time';

export const baselineRule: Rule = (brief) => {
  const signals: Signal[] = [];
  const at = (h: number) => brief.dayStartMs + h * HOUR_MS;
  const isWeekend = brief.weekday >= 6;

  if (!isWeekend && !brief.schoolDay) {
    signals.push({
      id: 'no-school-project-day',
      label: 'No school today',
      weight: 35,
      confidence: 1,
      window: { startMs: at(9), endMs: at(23) },
      reason: 'No school today — a full project day at the desk.',
    });
  }

  if (isWeekend) {
    signals.push({
      id: 'weekend-baseline',
      label: 'Weekend',
      weight: 10,
      confidence: 1,
      window: { startMs: at(9), endMs: at(23) },
      reason: "It's the weekend — anything can happen.",
    });
  }

  signals.push({
    id: 'late-night',
    label: 'Late night',
    weight: -40,
    confidence: 1,
    window: { startMs: at(23), endMs: brief.dayEndMs },
    reason: "It's late. Mike should be asleep.",
  });

  signals.push({
    id: 'early-morning',
    label: 'Early morning',
    weight: -40,
    confidence: 1,
    window: { startMs: brief.dayStartMs, endMs: at(7) },
    reason: 'Mike is asleep. Probably.',
  });

  return signals;
};
```

`src/engine/rules/school.ts`:

```ts
import type { Rule } from '../types';
import { HOUR_MS } from '../../lib/time';

export const schoolRule: Rule = (brief) => {
  if (!brief.schoolDay) return [];
  const at = (h: number) => brief.dayStartMs + h * HOUR_MS;

  return [
    {
      id: 'teaching',
      label: 'Teaching',
      weight: -80,
      confidence: 1,
      window: { startMs: at(7.5), endMs: at(15.5) },
      reason: 'Mike is at school molding young minds.',
    },
    {
      id: 'school-evening',
      label: 'After school',
      weight: 40,
      confidence: 1,
      window: { startMs: at(17.5), endMs: at(23) },
      reason: "School's out — prime project hours.",
    },
  ];
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/rules-baseline-school.test.ts`
Expected: PASS (9 tests). Note the teaching test expects verdict "NO WAY" purely from score −80 — that is correct per the ladder.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers.ts src/engine/rules/baseline.ts src/engine/rules/school.ts tests/rules-baseline-school.test.ts
git commit -m "feat: baseline and school rules"
```

---

### Task 6: Personal calendar data + personal rule

**Files:**
- Create: `calendar/personal.json`, `src/providers/personal.ts`, `src/engine/rules/personal.ts`
- Test: `tests/personal.test.ts`

**Interfaces:**
- Consumes: `PersonalHoliday`, `Rule` from `src/engine/types`.
- Produces:
  - `calendar/personal.json` schema:

```json
{
  "schoolTerms": [{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }],
  "vacations": [{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "title": "..." }],
  "holidays": {
    "MM-DD": { "title": "...", "reason": "...", "weight": -40, "hardOverride": "NO WAY" }
  }
}
```

  - `src/providers/personal.ts`:
    - `interface PersonalCalendar { schoolTerms: DateRange[]; vacations: Array<DateRange & { title?: string }>; holidays: Record<string, PersonalHoliday> }` with `interface DateRange { start: string; end: string }`
    - `holidayFor(cal: PersonalCalendar, date: string): PersonalHoliday | null`
    - `inSchoolTerm(cal: PersonalCalendar, date: string): boolean` (inside a term AND not inside a vacation; range ends inclusive)
  - `src/engine/rules/personal.ts`: `personalRule: Rule` — if `brief.personal`, emit one all-day signal `{ id: 'personal-' + slug(title), weight, hardOverride?, reason }`.

- [ ] **Step 1: Write calendar/personal.json**

Weights per spec (hard override for Mike's birthday; "No"-tier days −40/−60; Christmas/New Year's Probably-tier +25). School terms/vacations are best-guess placeholders Mike edits by hand later — that is the file's purpose.

```json
{
  "schoolTerms": [
    { "start": "2025-09-02", "end": "2026-06-12" },
    { "start": "2026-09-08", "end": "2027-06-11" }
  ],
  "vacations": [
    { "start": "2025-12-22", "end": "2026-01-02", "title": "Christmas break" },
    { "start": "2026-03-30", "end": "2026-04-06", "title": "Easter break" }
  ],
  "holidays": {
    "01-01": {
      "title": "New Year's Day",
      "reason": "New Year's Day is one of the best days to get stuff done!",
      "weight": 25
    },
    "02-22": {
      "title": "Steve Irwin's Birthday",
      "reason": "It's Steve Irwin's Birthday, which Mike observes outdoors!",
      "weight": -40
    },
    "03-03": {
      "title": "World Wildlife Day",
      "reason": "It's World Wildlife Day, which Mike observes at a state or national park!",
      "weight": -40
    },
    "04-22": {
      "title": "Earth Day",
      "reason": "It's Earth Day, which Mike observes by planting trees outside!",
      "weight": -40
    },
    "08-20": {
      "title": "Mike's Birthday",
      "reason": "It's Mike's (and Andrew's) birthday today!!!",
      "weight": -100,
      "hardOverride": "NO WAY"
    },
    "08-22": {
      "title": "National Honey Bee Day",
      "reason": "It's National Honey Bee Day, which Mike observes outdoors in the garden!",
      "weight": -40
    },
    "09-12": {
      "title": "Ashley's Birthday",
      "reason": "It's Ashley's birthday today!",
      "weight": -60
    },
    "11-15": {
      "title": "Steve Irwin Day",
      "reason": "It's Steve Irwin Day, which Mike observes by repeat-watching his farewell documentary.",
      "weight": -40
    },
    "12-25": {
      "title": "Christmas",
      "reason": "Christmas is one of the best days to get stuff done!",
      "weight": 25
    }
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/personal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import cal from '../calendar/personal.json';
import { holidayFor, inSchoolTerm, type PersonalCalendar } from '../src/providers/personal';
import { personalRule } from '../src/engine/rules/personal';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

const calendar = cal as unknown as PersonalCalendar;

describe('personal provider', () => {
  it('finds a fixed holiday by MM-DD', () => {
    const h = holidayFor(calendar, '2026-08-20');
    expect(h?.title).toBe("Mike's Birthday");
    expect(h?.hardOverride).toBe('NO WAY');
  });

  it('returns null on a plain day', () => {
    expect(holidayFor(calendar, '2026-08-07')).toBeNull();
  });

  it('school term includes a term weekday and excludes vacations and summer', () => {
    expect(inSchoolTerm(calendar, '2026-03-10')).toBe(true);
    expect(inSchoolTerm(calendar, '2025-12-26')).toBe(false); // Christmas break
    expect(inSchoolTerm(calendar, '2026-07-15')).toBe(false); // summer
    expect(inSchoolTerm(calendar, '2026-06-12')).toBe(true);  // inclusive end
  });
});

describe('personalRule', () => {
  it("Mike's birthday pins NO WAY all day", () => {
    const brief = makeBrief('2026-08-20', {
      personal: holidayFor(calendar, '2026-08-20'),
    });
    const a = combine(personalRule(brief), nyTimeToMs('2026-08-20', 14, 0));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('birthday');
  });

  it('Christmas leans positive', () => {
    const brief = makeBrief('2026-12-25', {
      personal: holidayFor(calendar, '2026-12-25'),
    });
    const a = combine(personalRule(brief), nyTimeToMs('2026-12-25', 14, 0));
    expect(a.score).toBe(25);
  });

  it('emits nothing on a plain day', () => {
    expect(personalRule(makeBrief('2026-08-07'))).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/personal.test.ts`
Expected: FAIL — cannot resolve provider/rule modules.

- [ ] **Step 4: Implement provider and rule**

`src/providers/personal.ts`:

```ts
import type { PersonalHoliday } from '../engine/types';

export interface DateRange { start: string; end: string }

export interface PersonalCalendar {
  schoolTerms: DateRange[];
  vacations: Array<DateRange & { title?: string }>;
  holidays: Record<string, PersonalHoliday>;
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function holidayFor(cal: PersonalCalendar, date: string): PersonalHoliday | null {
  return cal.holidays[date.slice(5)] ?? null;
}

export function inSchoolTerm(cal: PersonalCalendar, date: string): boolean {
  const inTerm = cal.schoolTerms.some((t) => inRange(date, t));
  const onVacation = cal.vacations.some((v) => inRange(date, v));
  return inTerm && !onVacation;
}
```

`src/engine/rules/personal.ts`:

```ts
import type { Rule } from '../types';

export const personalRule: Rule = (brief) => {
  if (!brief.personal) return [];
  const slug = brief.personal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return [
    {
      id: `personal-${slug}`,
      label: brief.personal.title,
      weight: brief.personal.weight,
      confidence: 1,
      window: { startMs: brief.dayStartMs, endMs: brief.dayEndMs },
      reason: brief.personal.reason,
      ...(brief.personal.hardOverride ? { hardOverride: brief.personal.hardOverride } : {}),
    },
  ];
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/personal.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add calendar/personal.json src/providers/personal.ts src/engine/rules/personal.ts tests/personal.test.ts
git commit -m "feat: personal calendar provider and rule"
```

---

### Task 7: Liturgical calendar provider + rule

**Files:**
- Create: `src/providers/liturgical.ts`, `src/engine/rules/liturgical.ts`
- Test: `tests/liturgical.test.ts`

**Interfaces:**
- Consumes: `LiturgicalDay`, `Rule` from `src/engine/types`.
- Produces:
  - `easterDate(year: number): string` — Gregorian computus, `YYYY-MM-DD`.
  - `liturgicalDay(date: string): LiturgicalDay | null` — fixed feasts and Easter-relative days:
    - Fixed, `dayOff: true`: 08-15 Assumption of Mary, 11-01 All Saints' Day, 12-08 Immaculate Conception, 12-25 Christmas.
    - Easter-relative: Holy Thursday (E−3, off), Good Friday (E−2, off), Easter Monday (E+1, off), Ash Wednesday (E−46, **not** off), Easter Sunday (E, off, `familyDay: { weight: -60, reason: 'Mike loves to celebrate Easter (and eat Easter bread) with his family!' }`).
  - `liturgicalRule: Rule`:
    - If `brief.liturgical?.familyDay`: all-day signal with that weight/reason, id `liturgical-family-day`.
    - Else if `brief.liturgical?.dayOff && brief.inSchoolTerm && brief.weekday <= 5`: +60 all-day, id `holy-day-off`, reason `` `${name} — a day off from teaching, so Mike is absolutely at his desk.` ``

- [ ] **Step 1: Write the failing tests**

`tests/liturgical.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { easterDate, liturgicalDay } from '../src/providers/liturgical';
import { liturgicalRule } from '../src/engine/rules/liturgical';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

describe('easterDate', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
  ])('computes Easter %i as %s', (year, date) => {
    expect(easterDate(year)).toBe(date);
  });
});

describe('liturgicalDay', () => {
  it('finds fixed holy days of obligation', () => {
    expect(liturgicalDay('2026-11-01')).toMatchObject({ name: "All Saints' Day", dayOff: true });
    expect(liturgicalDay('2026-12-08')).toMatchObject({ dayOff: true });
  });

  it('finds Easter-relative days for 2026 (Easter = Apr 5)', () => {
    expect(liturgicalDay('2026-04-03')).toMatchObject({ name: 'Good Friday', dayOff: true });
    expect(liturgicalDay('2026-04-02')).toMatchObject({ name: 'Holy Thursday', dayOff: true });
    expect(liturgicalDay('2026-04-06')).toMatchObject({ name: 'Easter Monday', dayOff: true });
    expect(liturgicalDay('2026-02-18')).toMatchObject({ name: 'Ash Wednesday', dayOff: false });
    expect(liturgicalDay('2026-04-05')?.familyDay?.weight).toBe(-60);
  });

  it('returns null on ordinary days', () => {
    expect(liturgicalDay('2026-08-07')).toBeNull();
  });
});

describe('liturgicalRule', () => {
  it('holy day during school term on a weekday = strong yes', () => {
    // 2026-12-08 is a Tuesday inside the school term
    const brief = makeBrief('2026-12-08', {
      inSchoolTerm: true,
      liturgical: liturgicalDay('2026-12-08'),
    });
    const a = combine(liturgicalRule(brief), nyTimeToMs('2026-12-08', 11, 0));
    expect(a.score).toBe(60);
    expect(a.headline).toContain('day off from teaching');
  });

  it('holy day outside school term emits nothing', () => {
    // 2026-08-15 Assumption falls in summer (a Saturday, and out of term)
    const brief = makeBrief('2026-08-15', { liturgical: liturgicalDay('2026-08-15') });
    expect(liturgicalRule(brief)).toHaveLength(0);
  });

  it('Easter Sunday is a family day regardless of term', () => {
    const brief = makeBrief('2026-04-05', { liturgical: liturgicalDay('2026-04-05') });
    const a = combine(liturgicalRule(brief), nyTimeToMs('2026-04-05', 12, 0));
    expect(a.score).toBe(-60);
    expect(a.headline).toContain('Easter');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/liturgical.test.ts`
Expected: FAIL — cannot resolve modules.

- [ ] **Step 3: Implement provider and rule**

`src/providers/liturgical.ts`:

```ts
import type { LiturgicalDay } from '../engine/types';

/** Anonymous Gregorian computus. */
export function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const FIXED: Record<string, LiturgicalDay> = {
  '08-15': { name: 'Assumption of Mary', dayOff: true },
  '11-01': { name: "All Saints' Day", dayOff: true },
  '12-08': { name: 'Immaculate Conception', dayOff: true },
  '12-25': { name: 'Christmas', dayOff: true },
};

export function liturgicalDay(date: string): LiturgicalDay | null {
  const fixed = FIXED[date.slice(5)];
  if (fixed) return fixed;

  const easter = easterDate(Number(date.slice(0, 4)));
  const relative: Array<[number, LiturgicalDay]> = [
    [-46, { name: 'Ash Wednesday', dayOff: false }],
    [-3, { name: 'Holy Thursday', dayOff: true }],
    [-2, { name: 'Good Friday', dayOff: true }],
    [0, {
      name: 'Easter Sunday',
      dayOff: true,
      familyDay: {
        weight: -60,
        reason: 'Mike loves to celebrate Easter (and eat Easter bread) with his family!',
      },
    }],
    [1, { name: 'Easter Monday', dayOff: true }],
  ];

  for (const [offset, day] of relative) {
    if (addDays(easter, offset) === date) return day;
  }
  return null;
}
```

`src/engine/rules/liturgical.ts`:

```ts
import type { Rule } from '../types';

export const liturgicalRule: Rule = (brief) => {
  const lit = brief.liturgical;
  if (!lit) return [];
  const allDay = { startMs: brief.dayStartMs, endMs: brief.dayEndMs };

  if (lit.familyDay) {
    return [
      {
        id: 'liturgical-family-day',
        label: lit.name,
        weight: lit.familyDay.weight,
        confidence: 1,
        window: allDay,
        reason: lit.familyDay.reason,
      },
    ];
  }

  if (lit.dayOff && brief.inSchoolTerm && brief.weekday <= 5) {
    return [
      {
        id: 'holy-day-off',
        label: `${lit.name} (no school)`,
        weight: 60,
        confidence: 1,
        window: allDay,
        reason: `${lit.name} — a day off from teaching, so Mike is absolutely at his desk.`,
      },
    ];
  }

  return [];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/liturgical.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/providers/liturgical.ts src/engine/rules/liturgical.ts tests/liturgical.test.ts
git commit -m "feat: liturgical calendar provider and rule"
```

---

### Task 8: Football rules

**Files:**
- Create: `src/engine/rules/football.ts`
- Test: `tests/rules-football.test.ts`

**Interfaces:**
- Consumes: `Match`, `Rule`, `Signal` from `src/engine/types`; `HOUR_MS` from `src/lib/time`.
- Produces: `footballRule: Rule` and `BIG_TEAMS: string[]`.

Behavior (spec: Starter rule set → Football). Per match, the **most specific tier wins** for that match; the all-day ambience signals stack on top:

- Match window: `kickoffMs − 30min` → `kickoffMs + 2.5h`. If `kickoffMs` is null: all-day window with confidence 0.7 instead of 1.
- Liverpool in a final → `lfc-final`: hard override NO WAY, weight −100, all day, reason "Liverpool are in the {competition} final. Nothing else exists today."
- Liverpool match, live window → `lfc-live`: hard override NO WAY, weight −95, reason "Liverpool are playing {opponent} RIGHT NOW. Put it on!"
- Liverpool match → `lfc-today`: −60, all day, reason "Liverpool play {opponent} today — the whole day orbits kickoff."
- Non-Liverpool final (CL/EL) → `cup-final`: −70, all day.
- Big v big → `big-v-big`: −40, match window, reason "{home} v {away} — Mike is definitely watching that."
- One big team → `big-team`: −25, match window.
- Non-PL knockout match (no bigger tier) → `knockout`: −40, match window.
- Non-PL group match (no bigger tier) → `group-stage`: −15, match window.
- Any PL match today (regardless of other signals) → `pl-matchday`: −10, all day, one signal max.
- Competition display names: PL → "Premier League", CL → "Champions League", EL → "Europa League".

- [ ] **Step 1: Write the failing tests**

`tests/rules-football.test.ts`:

```ts
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
    const brief = makeBrief(D, { matches: [match({ home: 'Tottenham' })] });
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
    const brief = makeBrief(D, { matches: [match({ home: 'Man City', kickoffMs: null })] });
    const a = combine(footballRule(brief), nyTimeToMs(D, 21, 0));
    const big = a.signals.find((s) => s.id === 'big-team')!;
    expect(big.contribution).toBe(Math.round(-25 * 0.7));
  });

  it('exposes the big teams list', () => {
    expect(BIG_TEAMS).toContain('Liverpool');
    expect(BIG_TEAMS).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/rules-football.test.ts`
Expected: FAIL — cannot resolve `../src/engine/rules/football`.

- [ ] **Step 3: Implement src/engine/rules/football.ts**

```ts
import type { Match, Rule, Signal, TimeWindow, DayBrief } from '../types';
import { HOUR_MS } from '../../lib/time';

export const BIG_TEAMS = [
  'Liverpool', 'Man City', 'Arsenal', 'Man United', 'Chelsea', 'Tottenham',
];

const COMP_NAMES = { PL: 'Premier League', CL: 'Champions League', EL: 'Europa League' } as const;

function matchWindow(m: Match, brief: DayBrief): { window: TimeWindow; confidence: number } {
  if (m.kickoffMs === null) {
    return { window: { startMs: brief.dayStartMs, endMs: brief.dayEndMs }, confidence: 0.7 };
  }
  return {
    window: { startMs: m.kickoffMs - 0.5 * HOUR_MS, endMs: m.kickoffMs + 2.5 * HOUR_MS },
    confidence: 1,
  };
}

export const footballRule: Rule = (brief) => {
  const signals: Signal[] = [];
  const allDay = { startMs: brief.dayStartMs, endMs: brief.dayEndMs };

  for (const m of brief.matches) {
    const hasLiverpool = m.home === 'Liverpool' || m.away === 'Liverpool';
    const opponent = m.home === 'Liverpool' ? m.away : m.home;
    const bigCount = [m.home, m.away].filter((t) => BIG_TEAMS.includes(t)).length;
    const { window, confidence } = matchWindow(m, brief);

    if (hasLiverpool && m.isFinal) {
      signals.push({
        id: 'lfc-final',
        label: `Liverpool in the ${COMP_NAMES[m.competition]} final`,
        weight: -100,
        confidence,
        window: allDay,
        reason: `Liverpool are in the ${COMP_NAMES[m.competition]} final. Nothing else exists today.`,
        hardOverride: 'NO WAY',
      });
    } else if (hasLiverpool) {
      signals.push({
        id: 'lfc-live',
        label: 'Liverpool are playing',
        weight: -95,
        confidence,
        window,
        reason: `Liverpool are playing ${opponent} RIGHT NOW. Put it on!`,
        hardOverride: 'NO WAY',
      });
      signals.push({
        id: 'lfc-today',
        label: 'Liverpool matchday',
        weight: -60,
        confidence,
        window: allDay,
        reason: `Liverpool play ${opponent} today — the whole day orbits kickoff.`,
      });
    } else if (m.isFinal) {
      signals.push({
        id: 'cup-final',
        label: `${COMP_NAMES[m.competition]} final`,
        weight: -70,
        confidence,
        window: allDay,
        reason: `It's the ${COMP_NAMES[m.competition]} final — that's an all-day affair.`,
      });
    } else if (bigCount === 2) {
      signals.push({
        id: 'big-v-big',
        label: `${m.home} v ${m.away}`,
        weight: -40,
        confidence,
        window,
        reason: `${m.home} v ${m.away} — Mike is definitely watching that.`,
      });
    } else if (bigCount === 1) {
      const big = BIG_TEAMS.includes(m.home) ? m.home : m.away;
      signals.push({
        id: 'big-team',
        label: `${big} are playing`,
        weight: -25,
        confidence,
        window,
        reason: `${m.home} v ${m.away} is on and Mike is watching.`,
      });
    } else if (m.competition !== 'PL' && m.isKnockout) {
      signals.push({
        id: 'knockout',
        label: `${COMP_NAMES[m.competition]} knockout`,
        weight: -40,
        confidence,
        window,
        reason: `${COMP_NAMES[m.competition]} knockout football is on.`,
      });
    } else if (m.competition !== 'PL') {
      signals.push({
        id: 'group-stage',
        label: `${COMP_NAMES[m.competition]} group stage`,
        weight: -15,
        confidence,
        window,
        reason: `${COMP_NAMES[m.competition]} group games are on in the background.`,
      });
    }
  }

  if (brief.matches.some((m) => m.competition === 'PL')) {
    signals.push({
      id: 'pl-matchday',
      label: 'Premier League matchday',
      weight: -10,
      confidence: 1,
      window: allDay,
      reason: "It's a Premier League matchday.",
    });
  }

  return signals;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/rules-football.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules/football.ts tests/rules-football.test.ts
git commit -m "feat: football rules"
```

---

### Task 9: Weather rule

**Files:**
- Create: `src/engine/rules/weather.ts`
- Test: `tests/rules-weather.test.ts`

**Interfaces:**
- Consumes: `Rule`, `WeatherDay` from `src/engine/types`; `HOUR_MS` from `src/lib/time`.
- Produces: `weatherRule: Rule` — fires only when `brief.weather` is set AND the day is free (weekend or `!schoolDay`):
  - Nice (60 ≤ highF ≤ 95 AND precipProb < 40): −30, window 9:00–19:00, id `nice-weather`, reason `` `It's ${highF}° and gorgeous out — Mike is outside.` ``
  - Miserable (precipProb ≥ 60 OR highF < 45): +35, window 9:00–19:00, id `bad-weather`, reason "It's miserable out — perfect coding weather."
  - In-between: no signal.

- [ ] **Step 1: Write the failing tests**

`tests/rules-weather.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { weatherRule } from '../src/engine/rules/weather';
import { combine } from '../src/engine/combine';
import { nyTimeToMs } from '../src/lib/time';
import { makeBrief } from './helpers';

const SAT = '2026-08-08';

describe('weatherRule', () => {
  it('nice weekend weather pulls Mike outside', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 74, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 14, 0));
    expect(a.score).toBe(-30);
    expect(a.headline).toContain('74');
  });

  it('rainy weekend is coding weather', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 70, precipProb: 80 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 14, 0));
    expect(a.score).toBe(35);
  });

  it('freezing weekend is coding weather', () => {
    const brief = makeBrief('2026-01-17', { weather: { date: '2026-01-17', highF: 30, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs('2026-01-17', 14, 0));
    expect(a.score).toBe(35);
  });

  it('in-between weather emits nothing', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 55, precipProb: 50 } });
    expect(weatherRule(brief)).toHaveLength(0);
  });

  it('does not fire during a school day even with nice weather', () => {
    const brief = makeBrief('2026-03-10', {
      inSchoolTerm: true,
      schoolDay: true,
      weather: { date: '2026-03-10', highF: 75, precipProb: 5 },
    });
    expect(weatherRule(brief)).toHaveLength(0);
  });

  it('window closes at 7pm', () => {
    const brief = makeBrief(SAT, { weather: { date: SAT, highF: 74, precipProb: 10 } });
    const a = combine(weatherRule(brief), nyTimeToMs(SAT, 20, 0));
    expect(a.signals).toHaveLength(0);
  });

  it('emits nothing without weather data', () => {
    expect(weatherRule(makeBrief(SAT))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/rules-weather.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement src/engine/rules/weather.ts**

```ts
import type { Rule } from '../types';
import { HOUR_MS } from '../../lib/time';

export const weatherRule: Rule = (brief) => {
  const w = brief.weather;
  const isWeekend = brief.weekday >= 6;
  if (!w || (!isWeekend && brief.schoolDay)) return [];

  const window = {
    startMs: brief.dayStartMs + 9 * HOUR_MS,
    endMs: brief.dayStartMs + 19 * HOUR_MS,
  };

  const nice = w.highF >= 60 && w.highF <= 95 && w.precipProb < 40;
  const miserable = w.precipProb >= 60 || w.highF < 45;

  if (nice) {
    return [{
      id: 'nice-weather',
      label: `${w.highF}° and clear`,
      weight: -30,
      confidence: 1,
      window,
      reason: `It's ${w.highF}° and gorgeous out — Mike is outside.`,
    }];
  }

  if (miserable) {
    return [{
      id: 'bad-weather',
      label: 'Miserable weather',
      weight: 35,
      confidence: 1,
      window,
      reason: "It's miserable out — perfect coding weather.",
    }];
  }

  return [];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/rules-weather.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules/weather.ts tests/rules-weather.test.ts
git commit -m "feat: weather rule"
```

---

### Task 10: Rule registry + assess() with spec scenarios

**Files:**
- Create: `src/engine/rules/index.ts`, `src/engine/evaluate.ts`
- Test: `tests/assess.test.ts`

**Interfaces:**
- Consumes: all rules from Tasks 5–9; `combine` from Task 4.
- Produces:
  - `src/engine/rules/index.ts`: `export const allRules: Rule[]` (baseline, school, personal, liturgical, football, weather).
  - `src/engine/evaluate.ts`: `assess(brief: DayBrief, nowMs: number): Assessment` — runs `allRules.flatMap(r => r(brief))` through `combine`.

- [ ] **Step 1: Write the failing tests (spec Testing scenarios)**

`tests/assess.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assess } from '../src/engine/evaluate';
import { nyTimeToMs } from '../src/lib/time';
import { liturgicalDay } from '../src/providers/liturgical';
import { makeBrief } from './helpers';
import type { Match } from '../src/engine/types';

function lfcMatch(date: string, hour: number): Match {
  return {
    competition: 'PL',
    home: 'Liverpool',
    away: 'Everton',
    kickoffMs: nyTimeToMs(date, hour, 0),
    round: '5',
    isFinal: false,
    isKnockout: false,
  };
}

describe('assess — full-engine scenarios', () => {
  it('Liverpool matchday: NO WAY at kickoff, negative-but-softer at 9pm', () => {
    const D = '2026-08-08'; // Saturday
    const brief = makeBrief(D, { matches: [lfcMatch(D, 12)] });
    expect(assess(brief, nyTimeToMs(D, 12, 15)).verdict.text).toBe('NO WAY');
    const evening = assess(brief, nyTimeToMs(D, 21, 0));
    expect(evening.verdict.level).toBeGreaterThanOrEqual(4); // still No-ish
    expect(evening.verdict.text).not.toBe('NO WAY');
  });

  it('holy day on a school-term Tuesday: strong Yes at 11am', () => {
    const D = '2026-12-08'; // Immaculate Conception, a Tuesday
    const brief = makeBrief(D, { inSchoolTerm: true, liturgical: liturgicalDay(D) });
    const a = assess(brief, nyTimeToMs(D, 11, 0));
    // holy-day-off +60 and no-school-project-day +35
    expect(a.score).toBeGreaterThanOrEqual(50);
    expect(a.verdict.text).toBe('Yes.');
  });

  it('rainy Saturday leans yes; sunny Saturday leans no', () => {
    const D = '2026-08-08';
    const rainy = makeBrief(D, { weather: { date: D, highF: 66, precipProb: 90 } });
    const sunny = makeBrief(D, { weather: { date: D, highF: 74, precipProb: 5 } });
    expect(assess(rainy, nyTimeToMs(D, 14, 0)).verdict.text).toBe('Probably'); // 35 + 10
    expect(assess(sunny, nyTimeToMs(D, 14, 0)).verdict.text).toBe('No'); // -30 + 10
  });

  it('school day: NO WAY-level at 2pm, positive at 8pm', () => {
    const D = '2026-03-10'; // term-time Tuesday
    const brief = makeBrief(D, { inSchoolTerm: true, schoolDay: true });
    expect(assess(brief, nyTimeToMs(D, 14, 0)).verdict.text).toBe('NO WAY'); // teaching -80
    expect(assess(brief, nyTimeToMs(D, 20, 0)).verdict.text).toBe('Probably'); // +40
  });

  it('plain summer Tuesday afternoon: Probably; 1am: No', () => {
    const D = '2026-08-11';
    const brief = makeBrief(D);
    expect(assess(brief, nyTimeToMs(D, 14, 0)).verdict.text).toBe('Probably'); // +35
    expect(assess(brief, nyTimeToMs(D, 1, 0)).verdict.text).toBe('No'); // -40
  });

  it('birthday + Liverpool match: hard override with the biggest weight wins', () => {
    const D = '2026-08-20';
    const brief = makeBrief(D, {
      matches: [lfcMatch(D, 15)],
      personal: {
        title: "Mike's Birthday",
        reason: "It's Mike's (and Andrew's) birthday today!!!",
        weight: -100,
        hardOverride: 'NO WAY',
      },
    });
    const a = assess(brief, nyTimeToMs(D, 15, 30));
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toContain('birthday'); // -100 beats -95
  });

  it('empty brief at 8am gap yields the maybe fallback', () => {
    const D = '2026-08-11';
    const a = assess(makeBrief(D), nyTimeToMs(D, 8, 0));
    expect(a.verdict.text).toBe('Hmm… maybe?');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/assess.test.ts`
Expected: FAIL — cannot resolve `../src/engine/evaluate`.

- [ ] **Step 3: Implement registry and assess**

`src/engine/rules/index.ts`:

```ts
import type { Rule } from '../types';
import { baselineRule } from './baseline';
import { schoolRule } from './school';
import { personalRule } from './personal';
import { liturgicalRule } from './liturgical';
import { footballRule } from './football';
import { weatherRule } from './weather';

export const allRules: Rule[] = [
  baselineRule,
  schoolRule,
  personalRule,
  liturgicalRule,
  footballRule,
  weatherRule,
];
```

`src/engine/evaluate.ts`:

```ts
import type { Assessment, DayBrief } from './types';
import { combine } from './combine';
import { allRules } from './rules/index';

export function assess(brief: DayBrief, nowMs: number): Assessment {
  return combine(allRules.flatMap((rule) => rule(brief)), nowMs);
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: ALL tests pass. If a scenario expectation fails because stacked weights land one rung off, the bug is in the test's arithmetic comment — recompute by listing active signals; do NOT change rule weights (they are spec values).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules/index.ts src/engine/evaluate.ts tests/assess.test.ts
git commit -m "feat: rule registry and assess() with spec scenarios"
```

---

### Task 11: Fetch providers (TheSportsDB + Open-Meteo)

**Files:**
- Create: `src/providers/football.ts`, `src/providers/weather.ts`, `src/build/fetch.ts`
- Test: `tests/providers-fetch.test.ts`

**Interfaces:**
- Consumes: `Match` from `src/engine/types`.
- Produces:
  - `src/providers/football.ts`:
    - `seasonSlug(nyDate: string): string` — month ≥ 7 → `"YYYY-YYYY+1"`, else `"YYYY-1-YYYY"` (TheSportsDB format, e.g. `2026-2027`).
    - `interface Fixture { competition: 'PL' | 'CL' | 'EL'; date: string; kickoffUtc: string | null; home: string; away: string; round: string; isFinal: boolean; isKnockout: boolean }`
    - `normalizeEvents(events: unknown[], competition: 'PL' | 'CL' | 'EL'): Fixture[]`
    - `fetchFixtures(competition: 'PL' | 'CL' | 'EL', season: string): Promise<Fixture[]>` (network)
    - `LEAGUE_IDS = { PL: 4328, CL: 4480, EL: 4481 }`
  - `src/providers/weather.ts`:
    - `normalizeForecast(apiResponse: unknown): WeatherDay[]`
    - `fetchForecast(): Promise<WeatherDay[]>` (network; lat 39.9607, lon −75.6055, fahrenheit, timezone America/New_York)
  - `src/build/fetch.ts`: script — for each provider, fetch and write `data/fixtures-PL.json`, `data/fixtures-CL.json`, `data/fixtures-EL.json`, `data/weather.json`; on any failure log a warning and leave the existing file untouched (spec: Error Handling).
  - TheSportsDB round conventions: `intRound === '160'` → final; `['125','150','160','200']` → knockout. Also treat `strEvent`/`strFilename` containing `"Final"` as final. Fallback knockout heuristic for CL/EL: event month between 2 and 6.

- [ ] **Step 1: Write the failing tests (pure normalizers only — no network in tests)**

`tests/providers-fetch.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/providers-fetch.test.ts`
Expected: FAIL — cannot resolve modules.

- [ ] **Step 3: Implement the providers**

`src/providers/football.ts`:

```ts
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
    const nameHasFinal = /\bFinal\b/i.test(raw.strEvent ?? raw.strFilename ?? '');
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
  const key = process.env.THESPORTSDB_KEY ?? '3';
  const url = `https://www.thesportsdb.com/api/v1/json/${key}/eventsseason.php?id=${LEAGUE_IDS[competition]}&s=${season}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB ${competition} ${season}: HTTP ${res.status}`);
  const body = (await res.json()) as { events?: unknown[] | null };
  return normalizeEvents(body.events ?? [], competition);
}
```

`src/providers/weather.ts`:

```ts
import type { WeatherDay } from '../engine/types';

const LAT = 39.9607;
const LON = -75.6055;

export function normalizeForecast(apiResponse: unknown): WeatherDay[] {
  const daily = (apiResponse as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      precipitation_probability_max?: number[];
    };
  })?.daily;
  if (!daily?.time) return [];
  return daily.time.map((date, i) => ({
    date,
    highF: Math.round(daily.temperature_2m_max?.[i] ?? 0),
    precipProb: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
  }));
}

export async function fetchForecast(): Promise<WeatherDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&daily=temperature_2m_max,precipitation_probability_max' +
    '&temperature_unit=fahrenheit&timezone=America%2FNew_York';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  return normalizeForecast(await res.json());
}
```

`src/build/fetch.ts`:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { fetchFixtures, seasonSlug } from '../providers/football';
import { fetchForecast } from '../providers/weather';
import { nyDateString } from '../lib/time';

const DATA_DIR = new URL('../../data/', import.meta.url).pathname;

async function attempt(name: string, file: string, get: () => Promise<unknown>) {
  try {
    const result = await get();
    writeFileSync(`${DATA_DIR}${file}`, JSON.stringify(result, null, 2) + '\n');
    console.log(`fetched ${name} -> data/${file}`);
  } catch (err) {
    console.warn(`WARN: ${name} fetch failed, keeping existing data/${file}:`, err);
  }
}

mkdirSync(DATA_DIR, { recursive: true });
const season = seasonSlug(nyDateString(Date.now()));

await attempt('Premier League fixtures', 'fixtures-PL.json', () => fetchFixtures('PL', season));
await attempt('Champions League fixtures', 'fixtures-CL.json', () => fetchFixtures('CL', season));
await attempt('Europa League fixtures', 'fixtures-EL.json', () => fetchFixtures('EL', season));
await attempt('Weather forecast', 'weather.json', () => fetchForecast());
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/providers-fetch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Smoke-test the live fetch**

Run: `npm run fetch`
Expected: four `fetched ... ->` lines (or WARN lines if an API is down — the script must exit 0 either way). Inspect `data/fixtures-PL.json` — it should contain fixtures with `Liverpool` appearing as `home` or `away`. If TheSportsDB returns null events for key `3`, re-run with `THESPORTSDB_KEY=123 npm run fetch`; if a key works, note it in the README task.

- [ ] **Step 6: Commit (including fetched data)**

```bash
git add src/providers/football.ts src/providers/weather.ts src/build/fetch.ts tests/providers-fetch.test.ts data
git commit -m "feat: football and weather fetch providers"
```

---

### Task 12: Day-brief compiler

**Files:**
- Create: `src/build/brief.ts`, `src/build/compile.ts`
- Test: `tests/brief.test.ts`

**Interfaces:**
- Consumes: `Fixture` from `src/providers/football`; `PersonalCalendar`, `holidayFor`, `inSchoolTerm` from `src/providers/personal`; `liturgicalDay` from `src/providers/liturgical`; time helpers; `DayBrief`, `Match`, `WeatherDay` types.
- Produces:
  - `src/build/brief.ts`: `buildBrief(input: { date: string; fixtures: Fixture[]; forecast: WeatherDay[]; calendar: PersonalCalendar; generatedAtMs: number }): DayBrief` — pure, fully testable:
    - `matches`: fixtures whose `date` equals the brief date, mapped to `Match` (`kickoffMs = Date.parse(kickoffUtc)` or null).
    - `weather`: forecast entry matching the date, else null.
    - `liturgical`: `liturgicalDay(date)`.
    - `personal`: `holidayFor(calendar, date)`.
    - `inSchoolTerm`: from calendar. `schoolDay`: weekday 1–5 AND inSchoolTerm AND NOT (liturgical?.dayOff).
  - `src/build/compile.ts`: script — reads `data/fixtures-*.json` (missing files → empty arrays), `data/weather.json`, `calendar/personal.json`; date = `--date YYYY-MM-DD` argv override or `nyDateString(Date.now())`; writes `data/daybrief.json`.

- [ ] **Step 1: Write the failing tests**

`tests/brief.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/brief.test.ts`
Expected: FAIL — cannot resolve `../src/build/brief`.

- [ ] **Step 3: Implement brief builder and compile script**

`src/build/brief.ts`:

```ts
import type { DayBrief, Match, WeatherDay } from '../engine/types';
import type { Fixture } from '../providers/football';
import { holidayFor, inSchoolTerm, type PersonalCalendar } from '../providers/personal';
import { liturgicalDay } from '../providers/liturgical';
import { dayBounds, nyParts, HOUR_MS } from '../lib/time';

export interface BriefInput {
  date: string;
  fixtures: Fixture[];
  forecast: WeatherDay[];
  calendar: PersonalCalendar;
  generatedAtMs: number;
}

export function buildBrief(input: BriefInput): DayBrief {
  const { date, fixtures, forecast, calendar, generatedAtMs } = input;
  const { startMs, endMs } = dayBounds(date);
  const weekday = nyParts(startMs + 12 * HOUR_MS).weekday;

  const matches: Match[] = fixtures
    .filter((f) => f.date === date)
    .map((f) => ({
      competition: f.competition,
      home: f.home,
      away: f.away,
      kickoffMs: f.kickoffUtc ? Date.parse(f.kickoffUtc) : null,
      round: f.round,
      isFinal: f.isFinal,
      isKnockout: f.isKnockout,
    }));

  const liturgical = liturgicalDay(date);
  const term = inSchoolTerm(calendar, date);

  return {
    date,
    weekday,
    dayStartMs: startMs,
    dayEndMs: endMs,
    inSchoolTerm: term,
    schoolDay: weekday <= 5 && term && !liturgical?.dayOff,
    matches,
    weather: forecast.find((w) => w.date === date) ?? null,
    liturgical,
    personal: holidayFor(calendar, date),
    generatedAtMs,
  };
}
```

`src/build/compile.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildBrief } from './brief';
import type { Fixture } from '../providers/football';
import type { PersonalCalendar } from '../providers/personal';
import type { WeatherDay } from '../engine/types';
import { nyDateString } from '../lib/time';

const root = new URL('../../', import.meta.url).pathname;

function readJson<T>(path: string, fallback: T): T {
  const full = `${root}${path}`;
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, 'utf8')) as T;
}

const dateArgIndex = process.argv.indexOf('--date');
const date = dateArgIndex >= 0 ? process.argv[dateArgIndex + 1] : nyDateString(Date.now());

const fixtures: Fixture[] = [
  ...readJson<Fixture[]>('data/fixtures-PL.json', []),
  ...readJson<Fixture[]>('data/fixtures-CL.json', []),
  ...readJson<Fixture[]>('data/fixtures-EL.json', []),
];

const brief = buildBrief({
  date,
  fixtures,
  forecast: readJson<WeatherDay[]>('data/weather.json', []),
  calendar: readJson<PersonalCalendar>('calendar/personal.json', {
    schoolTerms: [], vacations: [], holidays: {},
  }),
  generatedAtMs: Date.now(),
});

writeFileSync(`${root}data/daybrief.json`, JSON.stringify(brief, null, 2) + '\n');
console.log(`compiled day brief for ${date}: ${brief.matches.length} matches, ` +
  `weather=${brief.weather ? 'yes' : 'no'}, schoolDay=${brief.schoolDay}`);
```

- [ ] **Step 4: Run tests, then smoke-test the script**

Run: `npx vitest run tests/brief.test.ts` — Expected: PASS (7 assertions across 5 tests).
Run: `npm run compile` then `npm run compile -- --date 2026-12-08`
Expected: `data/daybrief.json` written; the second run logs `schoolDay=false`.

- [ ] **Step 5: Commit**

```bash
git add src/build/brief.ts src/build/compile.ts tests/brief.test.ts
git commit -m "feat: day-brief compiler"
```

---

### Task 13: The site — template, styles, client engine, prerender build

**Files:**
- Create: `src/site/index.html`, `src/site/styles.css`, `src/site/breakdown.ts`, `src/site/main.ts`, `src/build/render.ts`
- Test: `tests/breakdown.test.ts`

**Interfaces:**
- Consumes: `assess` from `src/engine/evaluate`; `Assessment` type; `nyDateString` from `src/lib/time`; `data/daybrief.json` (must exist — `npm run build` runs compile first).
- Produces:
  - `breakdownHtml(a: Assessment): string` — the "why?" panel body (shared by client and prerender).
  - `npm run build` emits `web/index.html` (prerendered, styles inlined) and `web/assets/main.js` (bundle). Existing favicons in `web/` are untouched.
  - Template placeholders (exact tokens): `{{STYLES}}`, `{{LEVEL}}`, `{{VERDICT}}`, `{{REASON}}`, `{{BREAKDOWN}}`, `{{TIMESTAMP}}`.
  - Client behavior: on load and every 60s, re-assess with `Date.now()`; if `nyDateString(Date.now()) !== brief.date`, show the stale fallback: verdict "Probably" (level 2), headline "The data robot overslept — Mike is probably working.", empty breakdown.

- [ ] **Step 1: Write the failing test for the breakdown renderer**

`tests/breakdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { breakdownHtml } from '../src/site/breakdown';
import type { Assessment } from '../src/engine/types';

describe('breakdownHtml', () => {
  it('renders one row per signal plus the score math', () => {
    const a: Assessment = {
      verdict: { text: 'Nope', level: 5 },
      score: -55,
      headline: 'x',
      signals: [
        {
          id: 'a', label: 'Liverpool matchday', weight: -60, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: -60,
        },
        {
          id: 'b', label: 'After school', weight: 40, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: 5,
        },
      ],
    };
    const html = breakdownHtml(a);
    expect(html).toContain('Liverpool matchday');
    expect(html).toContain('−60');
    expect(html).toContain('+5');
    expect(html).toContain('score: −55');
    expect(html).toContain('Nope');
  });

  it('handles an empty signal list', () => {
    const a: Assessment = {
      verdict: { text: 'Hmm… maybe?', level: 3 }, score: 0, headline: 'x', signals: [],
    };
    expect(breakdownHtml(a)).toContain('No rules fired');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/breakdown.test.ts`
Expected: FAIL — cannot resolve `../src/site/breakdown`.

- [ ] **Step 3: Implement breakdown.ts, template, styles, client, and render script**

`src/site/breakdown.ts`:

```ts
import type { Assessment } from '../engine/types';

function fmt(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

export function breakdownHtml(a: Assessment): string {
  if (a.signals.length === 0) {
    return '<p class="math">No rules fired. The engine shrugs.</p>';
  }
  const rows = a.signals
    .map((s) => `<li><span>${s.label}</span><b>${fmt(s.contribution)}</b></li>`)
    .join('');
  return `<ul>${rows}</ul><p class="math">score: ${a.score < 0 ? `−${Math.abs(a.score)}` : a.score} → ${a.verdict.text}</p>`;
}
```

`src/site/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Is Mike Working?</title>
  <meta name="description" content="A very serious real-time answer to a very serious question.">
  <style>{{STYLES}}</style>
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
</head>
<body class="level-{{LEVEL}}">
  <main>
    <p class="question">Is Mike working?</p>
    <h1 id="verdict">{{VERDICT}}</h1>
    <p class="reason" id="reason">{{REASON}}</p>
    <details class="why" id="why">
      <summary>why?</summary>
      <div id="breakdown">{{BREAKDOWN}}</div>
    </details>
    <footer><small id="updated">as of {{TIMESTAMP}}</small></footer>
  </main>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>
```

`src/site/styles.css`:

```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; min-height: 100%; }

body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-align: center;
  color: #fff;
  transition: background-color 0.8s ease;
}

body.level-1 { background: #15803d; }
body.level-2 { background: #4d7c0f; }
body.level-3 { background: #b45309; }
body.level-4 { background: #c2410c; }
body.level-5 { background: #b91c1c; }
body.level-6 { background: #7f1d1d; }

main { padding: 2rem 1.25rem; max-width: 46rem; }

.question {
  font-size: 1.1rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.85;
  margin: 0 0 1rem;
}

h1 {
  font-size: clamp(4rem, 18vw, 11rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 1.5rem;
  text-wrap: balance;
}

.reason { font-size: 1.4rem; margin: 0 auto 2rem; max-width: 34ch; text-wrap: balance; }

.why { font-size: 0.95rem; opacity: 0.9; }
.why summary { cursor: pointer; display: inline-block; border-bottom: 1px dotted rgba(255,255,255,0.7); }
.why[open] summary { margin-bottom: 0.75rem; }
.why ul { list-style: none; margin: 0 auto; padding: 0; max-width: 24rem; text-align: left; }
.why li {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.2);
}
.why .math { margin-top: 0.75rem; font-variant-numeric: tabular-nums; }

footer { margin-top: 2.5rem; opacity: 0.6; }
```

`src/site/main.ts`:

```ts
import brief from '../../data/daybrief.json';
import { assess } from '../engine/evaluate';
import { breakdownHtml } from './breakdown';
import { nyDateString } from '../lib/time';
import type { Assessment, DayBrief } from '../engine/types';

const dayBrief = brief as unknown as DayBrief;

const STALE: Assessment = {
  verdict: { text: 'Probably', level: 2 },
  score: 0,
  headline: 'The data robot overslept — Mike is probably working.',
  signals: [],
};

function currentAssessment(): Assessment {
  const now = Date.now();
  return nyDateString(now) === dayBrief.date ? assess(dayBrief, now) : STALE;
}

function render(): void {
  const a = currentAssessment();
  document.body.className = `level-${a.verdict.level}`;
  document.getElementById('verdict')!.textContent = a.verdict.text;
  document.getElementById('reason')!.textContent = a.headline;
  document.getElementById('breakdown')!.innerHTML = breakdownHtml(a);
  document.getElementById('updated')!.textContent =
    'as of ' +
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
}

render();
setInterval(render, 60_000);
```

`src/build/render.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { assess } from '../engine/evaluate';
import { breakdownHtml } from '../site/breakdown';
import type { DayBrief } from '../engine/types';

const root = new URL('../../', import.meta.url).pathname;

const brief = JSON.parse(readFileSync(`${root}data/daybrief.json`, 'utf8')) as DayBrief;

mkdirSync(`${root}web/assets`, { recursive: true });

await build({
  entryPoints: [`${root}src/site/main.ts`],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: `${root}web/assets/main.js`,
});

const a = assess(brief, Date.now());
const styles = readFileSync(`${root}src/site/styles.css`, 'utf8');
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
  timeStyle: 'short',
}).format(new Date());

const html = readFileSync(`${root}src/site/index.html`, 'utf8')
  .replace('{{STYLES}}', styles)
  .replace('{{LEVEL}}', String(a.verdict.level))
  .replace('{{VERDICT}}', a.verdict.text)
  .replace('{{REASON}}', a.headline)
  .replace('{{BREAKDOWN}}', breakdownHtml(a))
  .replace('{{TIMESTAMP}}', timestamp);

writeFileSync(`${root}web/index.html`, html);
console.log(`rendered web/index.html: ${a.verdict.text} (score ${a.score})`);
```

- [ ] **Step 4: Run the test, then the full build**

Run: `npx vitest run tests/breakdown.test.ts` — Expected: PASS.
Run: `npm run build` — Expected: `rendered web/index.html: ...` with a plausible verdict; `web/assets/main.js` exists.
Run: `npm run compile -- --date 2026-12-08 && npx tsx src/build/render.ts` — Expected: a positive verdict (holy day). Then re-run plain `npm run build` to restore today.

- [ ] **Step 5: Eyeball it in a browser**

Run: `open web/index.html`
Expected: giant verdict centered, colored background matching the level, "why?" expands to the signal table. (File URL note: `/assets/main.js` won't load from `file://` — the prerendered content should still display; for a live check run `npx serve web` or `python3 -m http.server -d web 8080`.)

- [ ] **Step 6: Commit**

```bash
git add src/site src/build/render.ts tests/breakdown.test.ts
git commit -m "feat: giant-verdict site with live client engine"
```

---

### Task 14: GitHub Action, Render config, README, final verification

**Files:**
- Create: `.github/workflows/daily.yml`, `render.yaml`
- Create: `README.md` (root; replaces nothing — there is no root README)

**Interfaces:**
- Consumes: `npm run fetch` (Task 11), `npm run build` (Task 13).
- Produces: daily data-refresh automation + Render deploy config.

- [ ] **Step 1: Write the workflow**

`.github/workflows/daily.yml`:

```yaml
name: Daily data refresh

on:
  schedule:
    - cron: "30 8 * * *" # 4:30am EDT / 3:30am EST
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run fetch
      - name: Commit refreshed data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data
          if git diff --cached --quiet; then
            echo "No data changes today."
          else
            git commit -m "Daily data refresh"
            git push
          fi
```

- [ ] **Step 2: Write render.yaml**

```yaml
services:
  - type: web
    runtime: static
    name: ismikeworking
    buildCommand: npm ci && npm run build
    staticPublishPath: web
```

- [ ] **Step 3: Write README.md**

```markdown
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

## Tuning the rules

- Rule weights and windows: `src/engine/rules/*.ts`
- Verdict thresholds: `src/engine/verdicts.ts` (`LADDER`)
- School terms, vacations, birthdays, Irwin days: `calendar/personal.json`
- Holy days: `src/providers/liturgical.ts`

Adding a rule: write a `Rule` in `src/engine/rules/`, register it in
`src/engine/rules/index.ts`, add a test in `tests/`.
```

- [ ] **Step 4: Full verification**

Run: `npm test` — Expected: all suites pass.
Run: `npm run fetch && npm run build` — Expected: clean build, plausible verdict for today.
Run: `npx tsc --noEmit` — Expected: no type errors (fix any that appear).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/daily.yml render.yaml README.md
git commit -m "feat: daily refresh workflow, Render config, README"
```

- [ ] **Step 6: Manual follow-ups for Mike (not automatable here)**

Report these to the user at the end:
1. Push to GitHub; confirm the `Daily data refresh` workflow runs (Actions tab → run `workflow_dispatch` once manually).
2. In Render: New → Static Site → connect the repo (render.yaml supplies build command `npm ci && npm run build`, publish dir `web`).
3. Review `calendar/personal.json` school terms/vacations — the committed dates are placeholders.

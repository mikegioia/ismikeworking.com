import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
import { assess } from '../engine/evaluate';
import { breakdownHtml, escapeHtml } from '../site/breakdown';
import { nyDateString } from '../lib/time';
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

// Anchor time-travel renders (compile --date != today) to the brief's own noon so a
// prerendered day-specific brief actually scores against its own signal windows.
// Same-day production builds are unaffected — they use the real current time.
const nowMs =
  nyDateString(Date.now()) === brief.date ? Date.now() : brief.dayStartMs + 12 * 3_600_000;

const a = assess(brief, nowMs);
const styles = readFileSync(`${root}src/site/styles.css`, 'utf8');
const timestamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
  timeStyle: 'short',
}).format(new Date());

const html = readFileSync(`${root}src/site/index.html`, 'utf8')
  .replace('{{STYLES}}', () => styles)
  .replace('{{LEVEL}}', () => String(a.verdict.level))
  .replace('{{VERDICT}}', () => a.verdict.text)
  .replace('{{REASON}}', () => escapeHtml(a.headline))
  .replace('{{BREAKDOWN}}', () => breakdownHtml(a))
  .replace('{{TIMESTAMP}}', () => timestamp);

writeFileSync(`${root}web/index.html`, html);
console.log(`rendered web/index.html: ${a.verdict.text} (score ${a.score})`);

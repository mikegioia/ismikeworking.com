import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { assess } from '../engine/evaluate';
import { breakdownHtml, escapeHtml } from '../site/breakdown';
import { themeBootScript } from '../site/theme';
import { HOUR_MS } from '../lib/time';
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

// The day's canonical verdict: always assess at the brief's own noon, so the
// page reports the day, not the time of day. Same anchor as the snapshot log.
const nowMs = brief.dayStartMs + 12 * HOUR_MS;

const a = assess(brief, nowMs);
const styles = readFileSync(`${root}src/site/styles.css`, 'utf8');
const reportDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  dateStyle: 'full',
}).format(new Date(nowMs));

const html = readFileSync(`${root}src/site/index.html`, 'utf8')
  .replace('{{STYLES}}', () => styles)
  .replace('{{LEVEL}}', () => String(a.verdict.level))
  .replace('{{VERDICT}}', () => a.verdict.text)
  .replace('{{REASON}}', () => escapeHtml(a.headline))
  .replace('{{BREAKDOWN}}', () => breakdownHtml(a))
  .replace('{{REPORT_DATE}}', () => reportDate)
  .replace('{{THEME_BOOT}}', () => themeBootScript());

writeFileSync(`${root}web/index.html`, html);
const historyPath = `${root}data/history.json`;
writeFileSync(
  `${root}web/assets/history.json`,
  existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : '{"days":{}}\n'
);
console.log(`rendered web/index.html: ${a.verdict.text} (score ${a.score})`);

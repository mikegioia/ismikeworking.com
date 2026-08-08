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

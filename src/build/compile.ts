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
  ...readJson<Fixture[]>('data/fixtures-LFC.json', []),
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

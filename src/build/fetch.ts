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

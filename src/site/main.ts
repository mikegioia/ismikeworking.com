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

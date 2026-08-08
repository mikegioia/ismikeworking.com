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

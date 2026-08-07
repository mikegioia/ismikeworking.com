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

/** Epoch ms for a wall-clock time in NY. NY offset is always UTC-4 (EDT) or UTC-5 (EST).
 *
 * Handles three cases:
 * 1. Normal time: resolves uniquely to one of the two offsets.
 * 2. Ambiguous fall-back time (Nov 1 1:00–1:59 AM): resolves to the earlier (EDT, UTC-4) occurrence because offset 4 is tried first.
 * 3. Nonexistent spring-forward time (Mar 8 2:00–2:59 AM): falls through and shifts forward (e.g. 2:30 AM → 3:30 AM EDT).
 */
export function nyTimeToMs(date: string, hour = 0, minute = 0): number {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const utcGuess = Date.parse(`${date}T${hh}:${mm}:00Z`);
  // Try offsets in order: EDT first (4), then EST (5).
  // For ambiguous times, this means the earlier occurrence wins.
  for (const offsetHours of [4, 5]) {
    const candidate = utcGuess + offsetHours * HOUR_MS;
    const p = nyParts(candidate);
    if (p.hour === hour && p.minute === minute && nyDateString(candidate) === date) {
      return candidate;
    }
  }
  // Nonexistent spring-forward times (e.g. 2:30 AM on March 8) fall through here.
  // Return the time shifted forward (standard DST resolution).
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

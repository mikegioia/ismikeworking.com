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

  it('resolves nonexistent spring-forward time forward (2:30 AM → 3:30 AM EDT)', () => {
    // March 8 2026: 2:00–2:59 AM doesn't exist in NY (spring forward to 3:00 AM EDT)
    expect(nyTimeToMs('2026-03-08', 2, 30)).toBe(Date.parse('2026-03-08T07:30:00Z'));
  });

  it('resolves ambiguous fall-back time to earlier occurrence (1:30 AM EDT, not EST)', () => {
    // November 1 2026: 1:00–1:59 AM occurs twice (EDT then EST). Offset 4 (EDT) is tried first.
    expect(nyTimeToMs('2026-11-01', 1, 30)).toBe(Date.parse('2026-11-01T05:30:00Z'));
  });
});

import { describe, it, expect } from 'vitest';
import { staleHint } from '../src/site/stale';
import { nyTimeToMs } from '../src/lib/time';

describe('staleHint', () => {
  it('returns null when the brief is for today', () => {
    expect(staleHint('2026-08-08', nyTimeToMs('2026-08-08', 9, 0))).toBeNull();
  });

  it('returns null just before NY midnight', () => {
    expect(staleHint('2026-08-08', nyTimeToMs('2026-08-08', 23, 59))).toBeNull();
  });

  it("names the brief's weekday once the visitor's NY date is ahead", () => {
    // 2026-08-07 was a Friday.
    expect(staleHint('2026-08-07', nyTimeToMs('2026-08-08', 0, 5))).toBe(
      "Today's report hasn't landed yet — this is Friday's."
    );
  });

  it('handles multi-day gaps the same way', () => {
    expect(staleHint('2026-08-05', nyTimeToMs('2026-08-08', 12, 0))).toBe(
      "Today's report hasn't landed yet — this is Wednesday's."
    );
  });
});

import { describe, it, expect } from 'vitest';
import { combine } from '../src/engine/combine';
import type { Signal } from '../src/engine/types';

function sig(over: Partial<Signal>): Signal {
  return {
    id: 'test',
    label: 'Test',
    weight: 10,
    confidence: 1,
    window: { startMs: 0, endMs: 100 },
    reason: 'test reason',
    ...over,
  };
}

describe('combine', () => {
  it('sums weight × confidence for active signals only', () => {
    const a = combine(
      [
        sig({ id: 'a', weight: 40 }),
        sig({ id: 'b', weight: -30, confidence: 0.5 }),
        sig({ id: 'c', weight: 99, window: { startMs: 200, endMs: 300 } }),
      ],
      50
    );
    expect(a.score).toBe(25); // 40 + (-15); c inactive
    expect(a.verdict.text).toBe('Probably');
    expect(a.signals.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('headline comes from the strongest active signal', () => {
    const a = combine(
      [sig({ id: 'weak', weight: 10, reason: 'weak' }), sig({ id: 'strong', weight: -60, reason: 'strong' })],
      50
    );
    expect(a.headline).toBe('strong');
    expect(a.verdict.text).toBe('Nope'); // 10 - 60 = -50
  });

  it('hard override pins the verdict and headline regardless of score', () => {
    const a = combine(
      [
        sig({ id: 'pos', weight: 100, reason: 'very yes' }),
        sig({ id: 'lfc', weight: -95, reason: 'Liverpool are playing', hardOverride: 'NO WAY' }),
      ],
      50
    );
    expect(a.verdict.text).toBe('NO WAY');
    expect(a.headline).toBe('Liverpool are playing');
  });

  it('largest |weight| override wins when several fire', () => {
    const a = combine(
      [
        sig({ id: 'small', weight: -50, reason: 'small', hardOverride: 'Nope' }),
        sig({ id: 'big', weight: -100, reason: 'big', hardOverride: 'NO WAY' }),
      ],
      50
    );
    expect(a.verdict.text).toBe('NO WAY');
  });

  it('inactive hard overrides are ignored', () => {
    const a = combine([sig({ hardOverride: 'NO WAY', window: { startMs: 200, endMs: 300 } })], 50);
    expect(a.verdict.text).toBe('Hmm… maybe?');
    expect(a.headline).toBe('No data, no opinion.');
  });

  it('window end is exclusive', () => {
    const a = combine([sig({ window: { startMs: 0, endMs: 100 } })], 100);
    expect(a.signals).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import { toHistoryEntry, parseHistory, upsertDay, type HistoryEntry, type HistoryFile } from '../src/lib/history';
import type { Assessment } from '../src/engine/types';

const assessment: Assessment = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    {
      id: 'weekend-baseline',
      label: 'Weekend',
      weight: 10,
      confidence: 1,
      window: { startMs: 0, endMs: 1 },
      reason: "It's the weekend — anything can happen.",
      contribution: 10,
    },
  ],
};

const entry: HistoryEntry = {
  verdict: { text: 'No', level: 4 },
  score: -30,
  headline: "It's the weekend — anything can happen.",
  signals: [
    {
      id: 'weekend-baseline',
      label: 'Weekend',
      contribution: 10,
      reason: "It's the weekend — anything can happen.",
    },
  ],
};

describe('toHistoryEntry', () => {
  it('keeps verdict, score, headline, and slims signals to id/label/contribution/reason', () => {
    expect(toHistoryEntry(assessment)).toEqual(entry);
  });
});

describe('parseHistory', () => {
  it('parses a valid history file', () => {
    const text = JSON.stringify({ days: { '2026-08-08': entry } });
    expect(parseHistory(text).days['2026-08-08']).toEqual(entry);
  });

  it('returns empty history for null input', () => {
    expect(parseHistory(null)).toEqual({ days: {} });
  });

  it('returns empty history for malformed JSON', () => {
    expect(parseHistory('{nope')).toEqual({ days: {} });
  });

  it('returns empty history when days is missing', () => {
    expect(parseHistory('{"other": 1}')).toEqual({ days: {} });
  });
});

describe('upsertDay', () => {
  it('adds a new day', () => {
    const h: HistoryFile = { days: {} };
    upsertDay(h, '2026-08-08', entry);
    expect(h.days['2026-08-08']).toEqual(entry);
  });

  it('overwrites the same day and preserves others', () => {
    const other: HistoryEntry = { ...entry, score: 55, verdict: { text: 'Yes.', level: 1 } };
    const h: HistoryFile = { days: { '2026-08-07': other } };
    upsertDay(h, '2026-08-08', entry);
    upsertDay(h, '2026-08-08', { ...entry, score: 0 });
    expect(h.days['2026-08-08'].score).toBe(0);
    expect(h.days['2026-08-07']).toEqual(other);
  });
});

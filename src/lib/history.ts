import type { Assessment } from '../engine/types';

export interface HistorySignal {
  id: string;
  label: string;
  contribution: number;
  reason: string;
}

export interface HistoryEntry {
  verdict: { text: string; level: number };
  score: number;
  headline: string;
  signals: HistorySignal[];
}

export interface HistoryFile {
  days: Record<string, HistoryEntry>;
}

export function toHistoryEntry(a: Assessment): HistoryEntry {
  return {
    verdict: { text: a.verdict.text, level: a.verdict.level },
    score: a.score,
    headline: a.headline,
    signals: a.signals.map(({ id, label, contribution, reason }) => ({
      id, label, contribution, reason,
    })),
  };
}

export function parseHistory(text: string | null): HistoryFile {
  if (text) {
    try {
      const parsed = JSON.parse(text) as Partial<HistoryFile>;
      if (parsed && typeof parsed.days === 'object' && parsed.days !== null) {
        return { days: parsed.days };
      }
    } catch {
      // fall through to the warning below
    }
    console.warn('WARN: history.json malformed, starting fresh');
  }
  return { days: {} };
}

export function upsertDay(history: HistoryFile, date: string, entry: HistoryEntry): void {
  history.days[date] = entry;
}

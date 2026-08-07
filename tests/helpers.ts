import type { DayBrief } from '../src/engine/types';
import { dayBounds, nyParts } from '../src/lib/time';

export function makeBrief(date: string, over: Partial<DayBrief> = {}): DayBrief {
  const { startMs, endMs } = dayBounds(date);
  return {
    date,
    weekday: nyParts(startMs + 12 * 3_600_000).weekday,
    dayStartMs: startMs,
    dayEndMs: endMs,
    inSchoolTerm: false,
    schoolDay: false,
    matches: [],
    weather: null,
    liturgical: null,
    personal: null,
    generatedAtMs: startMs,
    ...over,
  };
}

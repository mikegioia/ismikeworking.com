import type { Rule, Signal } from '../types';
import { HOUR_MS } from '../../lib/time';

export const baselineRule: Rule = (brief) => {
  const signals: Signal[] = [];
  const at = (h: number) => brief.dayStartMs + h * HOUR_MS;
  const isWeekend = brief.weekday >= 6;

  if (!isWeekend && !brief.schoolDay) {
    signals.push({
      id: 'no-school-project-day',
      label: 'No school today',
      weight: 35,
      confidence: 1,
      window: { startMs: at(9), endMs: at(23) },
      reason: 'No school today — a full project day at the desk.',
    });
    signals.push({
      id: 'weekday',
      label: 'Weekday',
      weight: 20,
      confidence: 1,
      window: { startMs: at(9), endMs: at(23) },
      reason: "It's a weekday and Mike is on the clock.",
    });
  }

  if (isWeekend) {
    signals.push({
      id: 'weekend-baseline',
      label: 'Weekend',
      weight: 10,
      confidence: 1,
      window: { startMs: at(9), endMs: at(23) },
      reason: "It's the weekend — anything can happen.",
    });
  }

  signals.push({
    id: 'late-night',
    label: 'Late night',
    weight: -40,
    confidence: 1,
    window: { startMs: at(23), endMs: brief.dayEndMs },
    reason: "It's late. Mike should be asleep.",
  });

  signals.push({
    id: 'early-morning',
    label: 'Early morning',
    weight: -40,
    confidence: 1,
    window: { startMs: brief.dayStartMs, endMs: at(7) },
    reason: 'Mike is asleep. Probably.',
  });

  return signals;
};

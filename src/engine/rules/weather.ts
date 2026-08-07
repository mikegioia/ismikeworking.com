import type { Rule } from '../types';
import { HOUR_MS } from '../../lib/time';

export const weatherRule: Rule = (brief) => {
  const w = brief.weather;
  const isWeekend = brief.weekday >= 6;
  if (!w || (!isWeekend && brief.schoolDay)) return [];

  const window = {
    startMs: brief.dayStartMs + 9 * HOUR_MS,
    endMs: brief.dayStartMs + 19 * HOUR_MS,
  };

  const nice = w.highF >= 60 && w.highF <= 95 && w.precipProb < 40;
  const miserable = w.precipProb >= 60 || w.highF < 45;

  if (nice) {
    return [{
      id: 'nice-weather',
      label: `${w.highF}° and clear`,
      weight: -30,
      confidence: 1,
      window,
      reason: `It's ${w.highF}° and gorgeous out — Mike is outside.`,
    }];
  }

  if (miserable) {
    return [{
      id: 'bad-weather',
      label: 'Miserable weather',
      weight: 35,
      confidence: 1,
      window,
      reason: "It's miserable out — perfect coding weather.",
    }];
  }

  return [];
};

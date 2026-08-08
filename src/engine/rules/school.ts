import type { Rule } from '../types';
import { HOUR_MS } from '../../lib/time';

export const schoolRule: Rule = (brief) => {
  if (!brief.schoolDay) return [];
  const at = (h: number) => brief.dayStartMs + h * HOUR_MS;

  return [
    {
      id: 'teaching',
      label: 'Teaching',
      weight: -80,
      confidence: 1,
      window: { startMs: at(7.5), endMs: at(15.5) },
      reason: 'Mike is at school molding young minds.',
    },
  ];
};

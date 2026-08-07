import type { Rule } from '../types';

export const liturgicalRule: Rule = (brief) => {
  const lit = brief.liturgical;
  if (!lit) return [];
  const allDay = { startMs: brief.dayStartMs, endMs: brief.dayEndMs };

  if (lit.familyDay) {
    return [
      {
        id: 'liturgical-family-day',
        label: lit.name,
        weight: lit.familyDay.weight,
        confidence: 1,
        window: allDay,
        reason: lit.familyDay.reason,
      },
    ];
  }

  if (lit.dayOff && brief.inSchoolTerm && brief.weekday <= 5) {
    return [
      {
        id: 'holy-day-off',
        label: `${lit.name} (no school)`,
        weight: 60,
        confidence: 1,
        window: allDay,
        reason: `${lit.name} — a day off from teaching, so Mike is absolutely at his desk.`,
      },
    ];
  }

  return [];
};

import type { Rule } from '../types';

export const personalRule: Rule = (brief) => {
  if (!brief.personal) return [];
  const slug = brief.personal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return [
    {
      id: `personal-${slug}`,
      label: brief.personal.title,
      weight: brief.personal.weight,
      confidence: 1,
      window: { startMs: brief.dayStartMs, endMs: brief.dayEndMs },
      reason: brief.personal.reason,
      ...(brief.personal.hardOverride ? { hardOverride: brief.personal.hardOverride } : {}),
    },
  ];
};

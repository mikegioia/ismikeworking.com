import type { Assessment, DayBrief } from './types';
import { combine } from './combine';
import { allRules } from './rules/index';

export function assess(brief: DayBrief, nowMs: number): Assessment {
  return combine(allRules.flatMap((rule) => rule(brief)), nowMs);
}

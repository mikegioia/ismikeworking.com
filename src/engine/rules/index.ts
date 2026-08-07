import type { Rule } from '../types';
import { baselineRule } from './baseline';
import { schoolRule } from './school';
import { personalRule } from './personal';
import { liturgicalRule } from './liturgical';
import { footballRule } from './football';
import { weatherRule } from './weather';

export const allRules: Rule[] = [
  baselineRule,
  schoolRule,
  personalRule,
  liturgicalRule,
  footballRule,
  weatherRule,
];

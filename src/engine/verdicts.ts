import type { Verdict, VerdictText } from './types';

interface Rung { min: number; text: VerdictText; level: Verdict['level'] }

export const LADDER: Rung[] = [
  { min: 50, text: 'Yes.', level: 1 },
  { min: 20, text: 'Probably', level: 2 },
  { min: -19, text: 'Hmm… maybe?', level: 3 },
  { min: -49, text: 'No', level: 4 },
  { min: -79, text: 'Nope', level: 5 },
  { min: -Infinity, text: 'NO WAY', level: 6 },
];

export function scoreToVerdict(score: number): Verdict {
  for (const rung of LADDER) {
    if (score >= rung.min) return { text: rung.text, level: rung.level };
  }
  return { text: 'NO WAY', level: 6 };
}

export function verdictByText(text: VerdictText): Verdict {
  const rung = LADDER.find((r) => r.text === text)!;
  return { text: rung.text, level: rung.level };
}

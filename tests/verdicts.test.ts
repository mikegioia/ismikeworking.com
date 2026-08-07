import { describe, it, expect } from 'vitest';
import { scoreToVerdict, verdictByText } from '../src/engine/verdicts';

describe('verdict ladder', () => {
  it.each([
    [80, 'Yes.', 1],
    [50, 'Yes.', 1],
    [49, 'Probably', 2],
    [20, 'Probably', 2],
    [19, 'Hmm… maybe?', 3],
    [0, 'Hmm… maybe?', 3],
    [-19, 'Hmm… maybe?', 3],
    [-20, 'No', 4],
    [-49, 'No', 4],
    [-50, 'Nope', 5],
    [-79, 'Nope', 5],
    [-80, 'NO WAY', 6],
    [-200, 'NO WAY', 6],
  ])('maps score %i to %s (level %i)', (score, text, level) => {
    expect(scoreToVerdict(score)).toEqual({ text, level });
  });

  it('looks up a verdict by text', () => {
    expect(verdictByText('NO WAY')).toEqual({ text: 'NO WAY', level: 6 });
    expect(verdictByText('Yes.')).toEqual({ text: 'Yes.', level: 1 });
  });
});

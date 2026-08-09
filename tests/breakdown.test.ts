import { describe, it, expect } from 'vitest';
import { breakdownHtml } from '../src/site/breakdown';
import type { Assessment } from '../src/engine/types';

describe('breakdownHtml', () => {
  it('renders one row per signal plus the score math', () => {
    const a: Assessment = {
      verdict: { text: 'Nope', level: 5 },
      score: -55,
      headline: 'x',
      signals: [
        {
          id: 'a', label: 'Liverpool matchday', weight: -60, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: -60,
        },
        {
          id: 'b', label: 'After school', weight: 40, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: 5,
        },
      ],
    };
    const html = breakdownHtml(a);
    expect(html).toContain('Liverpool matchday');
    expect(html).toContain('−60');
    expect(html).toContain('+5');
    expect(html).toContain('score: −55');
    expect(html).toContain('Nope');
  });

  it('puts the number before the label when numberFirst is set', () => {
    const a: Assessment = {
      verdict: { text: 'Nope', level: 5 },
      score: -60,
      headline: 'x',
      signals: [
        {
          id: 'a', label: 'Liverpool matchday', weight: -60, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: -60,
        },
      ],
    };
    expect(breakdownHtml(a, { numberFirst: true }))
      .toContain('<li><b>−60</b><span>Liverpool matchday</span></li>');
    expect(breakdownHtml(a))
      .toContain('<li><span>Liverpool matchday</span><b>−60</b></li>');
  });

  it('handles an empty signal list', () => {
    const a: Assessment = {
      verdict: { text: 'Hmm… maybe?', level: 3 }, score: 0, headline: 'x', signals: [],
    };
    expect(breakdownHtml(a)).toContain('No rules fired');
  });

  it('escapes HTML in externally-sourced labels', () => {
    const a: Assessment = {
      verdict: { text: 'Nope', level: 5 },
      score: -60,
      headline: 'x',
      signals: [
        {
          id: 'a', label: '<img src=x onerror=alert(1)>', weight: -60, confidence: 1,
          window: { startMs: 0, endMs: 1 }, reason: 'r', contribution: -60,
        },
      ],
    };
    const html = breakdownHtml(a);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });
});

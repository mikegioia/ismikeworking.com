import type { ActiveSignal, Assessment, Signal } from './types';
import { scoreToVerdict, verdictByText } from './verdicts';

export function combine(signals: Signal[], nowMs: number): Assessment {
  const active: ActiveSignal[] = signals
    .filter((s) => nowMs >= s.window.startMs && nowMs < s.window.endMs)
    .map((s) => ({ ...s, contribution: Math.round(s.weight * s.confidence) }));

  const score = active.reduce((sum, s) => sum + s.contribution, 0);

  const byStrength = [...active].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );

  let verdict = scoreToVerdict(score);
  let headlineSignal: ActiveSignal | undefined = byStrength[0];

  const overrides = active.filter((s) => s.hardOverride);
  if (overrides.length > 0) {
    const top = overrides.reduce((a, b) =>
      Math.abs(b.weight) > Math.abs(a.weight) ? b : a
    );
    verdict = verdictByText(top.hardOverride!);
    headlineSignal = top;
  }

  return {
    verdict,
    score,
    headline: headlineSignal?.reason ?? 'No data, no opinion.',
    signals: active,
  };
}

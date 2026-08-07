import type { Match, Rule, Signal, TimeWindow, DayBrief } from '../types';
import { HOUR_MS } from '../../lib/time';

export const BIG_TEAMS = [
  'Liverpool', 'Manchester City', 'Arsenal', 'Manchester United', 'Chelsea', 'Tottenham Hotspur',
];

const COMP_NAMES = {
  PL: 'Premier League',
  CL: 'Champions League',
  EL: 'Europa League',
  CUP: 'Cup',
} as const;

function matchWindow(m: Match, brief: DayBrief): { window: TimeWindow; confidence: number } {
  if (m.kickoffMs === null) {
    return { window: { startMs: brief.dayStartMs, endMs: brief.dayEndMs }, confidence: 0.7 };
  }
  return {
    window: { startMs: m.kickoffMs - 0.5 * HOUR_MS, endMs: m.kickoffMs + 2.5 * HOUR_MS },
    confidence: 1,
  };
}

export const footballRule: Rule = (brief) => {
  const signals: Signal[] = [];
  const allDay = { startMs: brief.dayStartMs, endMs: brief.dayEndMs };

  for (const m of brief.matches) {
    const hasLiverpool = m.home === 'Liverpool' || m.away === 'Liverpool';
    const opponent = m.home === 'Liverpool' ? m.away : m.home;
    const bigCount = [m.home, m.away].filter((t) => BIG_TEAMS.includes(t)).length;
    const { window, confidence } = matchWindow(m, brief);

    if (hasLiverpool && m.isFinal) {
      signals.push({
        id: 'lfc-final',
        label: `Liverpool in the ${COMP_NAMES[m.competition]} final`,
        weight: -100,
        confidence,
        window: allDay,
        reason: `Liverpool are in the ${COMP_NAMES[m.competition]} final. Nothing else exists today.`,
        hardOverride: 'NO WAY',
      });
    } else if (hasLiverpool) {
      signals.push({
        id: 'lfc-live',
        label: 'Liverpool are playing',
        weight: -95,
        confidence,
        window,
        reason: `Liverpool are playing ${opponent} RIGHT NOW. Put it on!`,
        hardOverride: 'NO WAY',
      });
      signals.push({
        id: 'lfc-today',
        label: 'Liverpool matchday',
        weight: -60,
        confidence,
        window: allDay,
        reason: `Liverpool play ${opponent} today — the whole day orbits kickoff.`,
      });
    } else if (m.isFinal) {
      signals.push({
        id: 'cup-final',
        label: `${COMP_NAMES[m.competition]} final`,
        weight: -70,
        confidence,
        window: allDay,
        reason: `It's the ${COMP_NAMES[m.competition]} final — that's an all-day affair.`,
      });
    } else if (bigCount === 2) {
      signals.push({
        id: 'big-v-big',
        label: `${m.home} v ${m.away}`,
        weight: -40,
        confidence,
        window,
        reason: `${m.home} v ${m.away} — Mike is definitely watching that.`,
      });
    } else if (bigCount === 1) {
      const big = BIG_TEAMS.includes(m.home) ? m.home : m.away;
      signals.push({
        id: 'big-team',
        label: `${big} are playing`,
        weight: -25,
        confidence,
        window,
        reason: `${m.home} v ${m.away} is on and Mike is watching.`,
      });
    } else if (m.competition !== 'PL' && m.isKnockout) {
      signals.push({
        id: 'knockout',
        label: `${COMP_NAMES[m.competition]} knockout`,
        weight: -40,
        confidence,
        window,
        reason: `${COMP_NAMES[m.competition]} knockout football is on.`,
      });
    } else if (m.competition !== 'PL') {
      signals.push({
        id: 'group-stage',
        label: `${COMP_NAMES[m.competition]} group stage`,
        weight: -15,
        confidence,
        window,
        reason: `${COMP_NAMES[m.competition]} group games are on in the background.`,
      });
    }
  }

  if (brief.matches.some((m) => m.competition === 'PL')) {
    signals.push({
      id: 'pl-matchday',
      label: 'Premier League matchday',
      weight: -10,
      confidence: 1,
      window: allDay,
      reason: "It's a Premier League matchday.",
    });
  }

  return signals;
};

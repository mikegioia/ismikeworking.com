import type { DayBrief, Match, WeatherDay } from '../engine/types';
import type { Fixture } from '../providers/football';
import { holidayFor, inSchoolTerm, type PersonalCalendar } from '../providers/personal';
import { liturgicalDay } from '../providers/liturgical';
import { dayBounds, nyParts, HOUR_MS } from '../lib/time';

export interface BriefInput {
  date: string;
  fixtures: Fixture[];
  forecast: WeatherDay[];
  calendar: PersonalCalendar;
  generatedAtMs: number;
}

export function buildBrief(input: BriefInput): DayBrief {
  const { date, fixtures, forecast, calendar, generatedAtMs } = input;
  const { startMs, endMs } = dayBounds(date);
  const weekday = nyParts(startMs + 12 * HOUR_MS).weekday;

  const matches: Match[] = fixtures
    .filter((f) => f.date === date)
    .map((f) => ({
      competition: f.competition,
      home: f.home,
      away: f.away,
      kickoffMs: f.kickoffUtc ? Date.parse(f.kickoffUtc) : null,
      round: f.round,
      isFinal: f.isFinal,
      isKnockout: f.isKnockout,
    }));

  const liturgical = liturgicalDay(date);
  const term = inSchoolTerm(calendar, date);

  return {
    date,
    weekday,
    dayStartMs: startMs,
    dayEndMs: endMs,
    inSchoolTerm: term,
    schoolDay: weekday <= 5 && term && !liturgical?.dayOff,
    matches,
    weather: forecast.find((w) => w.date === date) ?? null,
    liturgical,
    personal: holidayFor(calendar, date),
    generatedAtMs,
  };
}

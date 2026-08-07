import type { PersonalHoliday } from '../engine/types';

export interface DateRange { start: string; end: string }

export interface PersonalCalendar {
  schoolTerms: DateRange[];
  vacations: Array<DateRange & { title?: string }>;
  holidays: Record<string, PersonalHoliday>;
}

function inRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function holidayFor(cal: PersonalCalendar, date: string): PersonalHoliday | null {
  return cal.holidays[date.slice(5)] ?? null;
}

export function inSchoolTerm(cal: PersonalCalendar, date: string): boolean {
  const inTerm = cal.schoolTerms.some((t) => inRange(date, t));
  const onVacation = cal.vacations.some((v) => inRange(date, v));
  return inTerm && !onVacation;
}

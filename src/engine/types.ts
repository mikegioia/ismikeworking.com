export type VerdictText = 'Yes.' | 'Probably' | 'Hmm… maybe?' | 'No' | 'Nope' | 'NO WAY';
export interface Verdict { text: VerdictText; level: 1 | 2 | 3 | 4 | 5 | 6 }
export interface TimeWindow { startMs: number; endMs: number }
export interface Signal {
  id: string;
  label: string;
  weight: number;       // signed: positive = working, negative = not working
  confidence: number;   // 0..1
  window: TimeWindow;
  reason: string;
  hardOverride?: VerdictText;
}
export interface Match {
  competition: 'PL' | 'CL' | 'EL';
  home: string;
  away: string;
  kickoffMs: number | null;
  round: string;
  isFinal: boolean;
  isKnockout: boolean;
}
export interface WeatherDay { date: string; highF: number; precipProb: number }
export interface PersonalHoliday { title: string; reason: string; weight: number; hardOverride?: VerdictText }
export interface LiturgicalDay {
  name: string;
  dayOff: boolean;                                   // school gives the day off
  familyDay?: { weight: number; reason: string };    // e.g. Easter Sunday
}
export interface DayBrief {
  date: string;          // YYYY-MM-DD (NY)
  weekday: number;       // 1=Mon…7=Sun
  dayStartMs: number;
  dayEndMs: number;
  inSchoolTerm: boolean; // date falls inside a school term, vacations excluded
  schoolDay: boolean;    // teaching day: weekday && inSchoolTerm && !liturgical day off
  matches: Match[];
  weather: WeatherDay | null;
  liturgical: LiturgicalDay | null;
  personal: PersonalHoliday | null;
  generatedAtMs: number;
}
export type Rule = (brief: DayBrief) => Signal[];
export interface ActiveSignal extends Signal { contribution: number }
export interface Assessment {
  verdict: Verdict;
  score: number;
  headline: string;
  signals: ActiveSignal[];
}

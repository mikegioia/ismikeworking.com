import type { WeatherDay } from '../engine/types';

const LAT = 39.9607;
const LON = -75.6055;

export function normalizeForecast(apiResponse: unknown): WeatherDay[] {
  const daily = (apiResponse as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      precipitation_probability_max?: number[];
    };
  })?.daily;
  if (!daily?.time) return [];
  return daily.time.map((date, i) => ({
    date,
    highF: Math.round(daily.temperature_2m_max?.[i] ?? 0),
    precipProb: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
  }));
}

export async function fetchForecast(): Promise<WeatherDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&daily=temperature_2m_max,precipitation_probability_max' +
    '&temperature_unit=fahrenheit&timezone=America%2FNew_York';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  return normalizeForecast(await res.json());
}

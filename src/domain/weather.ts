// Turning an hourly weather forecast into the day / night temperature and humidity of "Warunki". No I/O.
import { type ModelParams, MS_PER_HOUR } from './params';
import { isNightHour } from './physics';

/** Hourly forecast: parallel arrays, one entry per hour; missing values are NaN. */
export interface HourlyForecast {
  /** epoch ms of each hour */
  time: readonly number[];
  /** °C */
  temp: readonly number[];
  /** % RH */
  rh: readonly number[];
}

/** A place the forecast is requested for; coordinates rounded to 0.1°. */
export interface Place {
  name: string;
  lat: number;
  lon: number;
}

/** Whole °C / % values for the form; null where the forecast has no usable hour. */
export interface ForecastConditions {
  temp: number | null;
  rh: number | null;
  /** null as well while night mode is off */
  nightTemp: number | null;
  nightRh: number | null;
}

const roundedMean = (xs: readonly number[]): number | null => {
  const ok = xs.filter(Number.isFinite);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
};

/**
 * Means over the `p.forecastHours` hours from the hour containing `startMs`. With night mode on,
 * the hours in `p.night` give the night values and the others the day values; with it off, every
 * hour gives the day values, because the model then uses them around the clock.
 */
export function forecastConditions(
  f: HourlyForecast,
  startMs: number,
  night: boolean,
  p: ModelParams,
): ForecastConditions {
  const from = Math.floor(startMs / MS_PER_HOUR) * MS_PER_HOUR;
  const to = from + p.forecastHours * MS_PER_HOUR;
  const day = { temp: [] as number[], rh: [] as number[] };
  const dark = { temp: [] as number[], rh: [] as number[] };
  f.time.forEach((t, i) => {
    if (!(t >= from && t < to)) return;
    const bucket = night && isNightHour(t, p) ? dark : day;
    bucket.temp.push(f.temp[i] ?? NaN);
    bucket.rh.push(f.rh[i] ?? NaN);
  });
  return {
    temp: roundedMean(day.temp),
    rh: roundedMean(day.rh),
    nightTemp: roundedMean(dark.temp),
    nightRh: roundedMean(dark.rh),
  };
}

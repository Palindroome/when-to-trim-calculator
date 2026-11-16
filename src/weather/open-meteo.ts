// WeatherProvider backed by Open-Meteo (https://open-meteo.com/): no API key, CORS, data under CC BY 4.0.
import type { HourlyForecast, Place } from '../domain/weather';
import { roundCoord, WeatherError, type WeatherProvider } from './provider';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
/** today and tomorrow in the place's time zone cover the `ModelParams.forecastHours` (12 h) window */
const FORECAST_DAYS = 2;
const MAX_PLACES = 5;

interface ForecastResponse {
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    relative_humidity_2m?: unknown;
  };
}

interface GeocodingResponse {
  results?: { name?: unknown; admin1?: unknown; latitude?: unknown; longitude?: unknown }[];
}

/** JSON from `url`; network failures are `offline`, HTTP errors and non-JSON bodies `service`. */
async function getJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch {
    throw new WeatherError('offline');
  }
  if (!res.ok) throw new WeatherError('service');
  try {
    return await res.json();
  } catch {
    throw new WeatherError('service');
  }
}

const numbers = (xs: unknown): number[] | null =>
  Array.isArray(xs) ? xs.map((x) => (typeof x === 'number' ? x : NaN)) : null;

export function forecastUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    hourly: 'temperature_2m,relative_humidity_2m',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
  });
  return `${FORECAST_URL}?${q}`;
}

export function geocodingUrl(name: string, language: string): string {
  const q = new URLSearchParams({
    name,
    count: String(MAX_PLACES),
    language,
    format: 'json',
  });
  return `${GEOCODING_URL}?${q}`;
}

export function openMeteoProvider(fetchFn: typeof fetch = fetch.bind(globalThis)): WeatherProvider {
  return {
    async forecast(lat, lon): Promise<HourlyForecast> {
      const body = (await getJson(fetchFn, forecastUrl(lat, lon))) as ForecastResponse | null;
      const time = numbers(body?.hourly?.time);
      const temp = numbers(body?.hourly?.temperature_2m);
      const rh = numbers(body?.hourly?.relative_humidity_2m);
      if (!time || !temp || !rh) throw new WeatherError('service');
      // unixtime: seconds
      return { time: time.map((s) => s * 1000), temp, rh };
    },
    async searchPlace(name, language): Promise<Place[]> {
      const body = (await getJson(
        fetchFn,
        geocodingUrl(name, language),
      )) as GeocodingResponse | null;
      if (body === null || typeof body !== 'object') throw new WeatherError('service');
      return (body.results ?? []).flatMap((r) =>
        typeof r.name === 'string' &&
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number'
          ? [
              {
                name: typeof r.admin1 === 'string' ? `${r.name}, ${r.admin1}` : r.name,
                lat: roundCoord(r.latitude),
                lon: roundCoord(r.longitude),
              },
            ]
          : [],
      );
    },
  };
}

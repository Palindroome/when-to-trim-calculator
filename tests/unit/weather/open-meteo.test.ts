import { describe, expect, it, vi } from 'vitest';
import { forecastUrl, geocodingUrl, openMeteoProvider } from '../../../src/weather/open-meteo';
import { WeatherError } from '../../../src/weather/provider';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const FORECAST = {
  latitude: 50.1,
  longitude: 19.9,
  timezone: 'Europe/Warsaw',
  hourly_units: { time: 'unixtime', temperature_2m: '°C', relative_humidity_2m: '%' },
  hourly: {
    time: [1772611200, 1772614800, 1772618400],
    temperature_2m: [3.4, null, 5.1],
    relative_humidity_2m: [88, 85, 80],
  },
};

const GEOCODING = {
  results: [
    {
      name: 'Kraków',
      latitude: 50.06143,
      longitude: 19.93658,
      admin1: 'Lesser Poland',
      country: 'Poland',
    },
    { name: 'Krakow', latitude: 44.07, longitude: -89.12 },
    { name: 'broken' },
  ],
};

const params = (url: string): Record<string, string> =>
  Object.fromEntries(new URL(url).searchParams);

async function failure(p: Promise<unknown>): Promise<WeatherError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(WeatherError);
  return e as WeatherError;
}

describe('Open-Meteo forecast', () => {
  it('requests the hourly variables at coordinates rounded to 0.1°', () => {
    const url = forecastUrl(50.06143, 19.93658);
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(params(url)).toEqual({
      latitude: '50.1',
      longitude: '19.9',
      hourly: 'temperature_2m,relative_humidity_2m',
      timezone: 'auto',
      timeformat: 'unixtime',
      forecast_days: '2',
    });
  });

  it('parses the hourly arrays, with ms times and missing values as NaN', async () => {
    const fetchFn = vi.fn(async () => json(FORECAST));
    const f = await openMeteoProvider(fetchFn).forecast(50.06143, 19.93658);
    expect(fetchFn).toHaveBeenCalledWith(forecastUrl(50.1, 19.9));
    expect(f).toEqual({
      time: [1772611200000, 1772614800000, 1772618400000],
      temp: [3.4, NaN, 5.1],
      rh: [88, 85, 80],
    });
  });

  it('turns HTTP errors and unusable bodies into service errors', async () => {
    const provider = (r: () => Response) => openMeteoProvider(async () => r());
    expect((await failure(provider(() => json({ error: true }, 400)).forecast(1, 2))).kind).toBe(
      'service',
    );
    expect((await failure(provider(() => json({ hourly: {} })).forecast(1, 2))).kind).toBe(
      'service',
    );
    expect((await failure(provider(() => new Response('<html>')).forecast(1, 2))).kind).toBe(
      'service',
    );
  });

  it('turns network failures into offline errors', async () => {
    const provider = openMeteoProvider(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await failure(provider.forecast(1, 2))).kind).toBe('offline');
    expect((await failure(provider.searchPlace('Kraków', 'pl'))).kind).toBe('offline');
  });
});

describe('Open-Meteo place search', () => {
  it('asks for a few places in the UI language', () => {
    const url = geocodingUrl('Kraków', 'pl');
    expect(url.startsWith('https://geocoding-api.open-meteo.com/v1/search?')).toBe(true);
    expect(params(url)).toEqual({ name: 'Kraków', count: '5', language: 'pl', format: 'json' });
  });

  it('lists named places with rounded coordinates and skips incomplete ones', async () => {
    const places = await openMeteoProvider(async () => json(GEOCODING)).searchPlace('Krak', 'en');
    expect(places).toEqual([
      { name: 'Kraków, Lesser Poland', lat: 50.1, lon: 19.9 },
      { name: 'Krakow', lat: 44.1, lon: -89.1 },
    ]);
  });

  it('gives no places when nothing matches, and a service error on HTTP errors', async () => {
    expect(await openMeteoProvider(async () => json({})).searchPlace('xyz', 'pl')).toEqual([]);
    const e = await failure(openMeteoProvider(async () => json({}, 500)).searchPlace('xyz', 'pl'));
    expect(e.kind).toBe('service');
  });
});

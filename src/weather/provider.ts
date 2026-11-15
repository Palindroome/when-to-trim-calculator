// Where the optional weather fill of "Warunki" gets its data. The only code that sends anything off the device.
import type { HourlyForecast, Place } from '../domain/weather';

/** `offline`: the request did not reach the service; `service`: it answered with an error or unusable data. */
export type WeatherErrorKind = 'offline' | 'service';

export class WeatherError extends Error {
  constructor(readonly kind: WeatherErrorKind) {
    super(`weather request failed: ${kind}`);
  }
}

export interface WeatherProvider {
  /** Hourly temperature and humidity from now on; rejects with a `WeatherError`. */
  forecast(lat: number, lon: number): Promise<HourlyForecast>;
  /** Places matching a town name, named in `language`; rejects with a `WeatherError`. */
  searchPlace(name: string, language: string): Promise<Place[]>;
}

/** Coordinates are rounded to 0.1° (about 10 km) before they leave the device. */
export const roundCoord = (x: number): number => Math.round(x * 10) / 10;

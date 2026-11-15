import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../../../src/domain/params';
import { forecastConditions, type HourlyForecast } from '../../../src/domain/weather';

const at = (day: number, hour: number): number => new Date(2026, 2, day, hour).getTime();

/** Hourly forecast for 3–5 March (local time); temperature = hour of day, humidity from `rh`. */
function forecast(rh: (hour: number) => number = () => 60): HourlyForecast {
  const time: number[] = [];
  for (let day = 3; day <= 5; day++) for (let h = 0; h < 24; h++) time.push(at(day, h));
  const hours = time.map((t) => new Date(t).getHours());
  return { time, temp: hours, rh: hours.map(rh) };
}

describe('forecastConditions', () => {
  it('averages the next 24 h into the day values while night mode is off', () => {
    // 09:00 on the 4th until 08:00 on the 5th: every hour of the day once, mean 11.5
    expect(forecastConditions(forecast(), at(4, 9), false, DEFAULT_PARAMS)).toEqual({
      temp: 12,
      rh: 60,
      nightTemp: null,
      nightRh: null,
    });
  });

  it('splits day and night hours across midnight while night mode is on', () => {
    const f = forecast((h) => (h >= 22 || h < 7 ? 80 : 40));
    // day: 9–21 on the 4th and 7–8 on the 5th; night: 22–23 on the 4th and 0–6 on the 5th
    expect(forecastConditions(f, at(4, 9), true, DEFAULT_PARAMS)).toEqual({
      temp: 14,
      rh: 40,
      nightTemp: 7,
      nightRh: 80,
    });
  });

  it('starts at the hour containing the start time and ignores hours outside the window', () => {
    const f = forecast();
    const shifted = { ...f, temp: f.time.map((t, i) => (t < at(4, 9) ? 100 : f.temp[i]!)) };
    const mid = new Date(2026, 2, 4, 9, 40).getTime();
    expect(forecastConditions(shifted, mid, false, DEFAULT_PARAMS).temp).toBe(12);
    expect(
      forecastConditions(shifted, mid, false, { ...DEFAULT_PARAMS, forecastHours: 3 }).temp,
    ).toBe(10);
  });

  it('rounds to whole degrees and percent', () => {
    const time = [at(4, 10), at(4, 11)];
    const f = { time, temp: [20.4, 20.7], rh: [55.2, 55.4] };
    expect(forecastConditions(f, at(4, 10), false, DEFAULT_PARAMS)).toMatchObject({
      temp: 21,
      rh: 55,
    });
  });

  it('skips missing hours and gives null when none is usable', () => {
    const time = [at(4, 10), at(4, 11), at(4, 23)];
    const f = { time, temp: [NaN, 18, NaN], rh: [50, NaN] };
    expect(forecastConditions(f, at(4, 10), true, DEFAULT_PARAMS)).toEqual({
      temp: 18,
      rh: 50,
      nightTemp: null,
      nightRh: null,
    });
    expect(
      forecastConditions({ time: [], temp: [], rh: [] }, at(4, 10), false, DEFAULT_PARAMS),
    ).toEqual({ temp: null, rh: null, nightTemp: null, nightRh: null });
  });
});

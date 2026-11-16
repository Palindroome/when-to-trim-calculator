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
  it('averages the next 12 h into the day values while night mode is off', () => {
    expect(DEFAULT_PARAMS.forecastHours).toBe(12);
    // 07–18: mean 12.5
    expect(forecastConditions(forecast(), at(4, 7), false, DEFAULT_PARAMS)).toEqual({
      temp: 13,
      rh: 60,
      nightTemp: null,
      nightRh: null,
    });
    // 23 on the 4th and 0–10 on the 5th: every hour counts, mean 6.5
    expect(forecastConditions(forecast(), at(4, 23), false, DEFAULT_PARAMS)).toEqual({
      temp: 7,
      rh: 60,
      nightTemp: null,
      nightRh: null,
    });
  });

  it.each([
    // window 07–18 and 10–21: no night hour, so the night values stay null
    [7, { temp: 13, rh: 40, nightTemp: null, nightRh: null }],
    [10, { temp: 16, rh: 40, nightTemp: null, nightRh: null }],
    // 11–21 by day, 22 at night
    [11, { temp: 16, rh: 40, nightTemp: 22, nightRh: 80 }],
    // across midnight: 23 and 0–6 at night (mean 5.5), 7–10 by day (mean 8.5)
    [23, { temp: 9, rh: 40, nightTemp: 6, nightRh: 80 }],
  ])('splits the 12 h from %i:00 into day and night hours while night mode is on', (hour, c) => {
    const f = forecast((h) => (h >= 22 || h < 7 ? 80 : 40));
    expect(forecastConditions(f, at(4, hour), true, DEFAULT_PARAMS)).toEqual(c);
  });

  it('gives null day values when the window has only night hours', () => {
    // 22–3 with a 6 h window: mean of 22, 23, 0, 1, 2, 3 is 8.5
    expect(
      forecastConditions(forecast(), at(4, 22), true, { ...DEFAULT_PARAMS, forecastHours: 6 }),
    ).toEqual({ temp: null, rh: null, nightTemp: 9, nightRh: 60 });
  });

  it('starts at the hour containing the start time and ignores hours outside the window', () => {
    const f = forecast();
    const shifted = { ...f, temp: f.time.map((t, i) => (t < at(4, 9) ? 100 : f.temp[i]!)) };
    const mid = new Date(2026, 2, 4, 9, 40).getTime();
    // 09–20: mean 14.5
    expect(forecastConditions(shifted, mid, false, DEFAULT_PARAMS).temp).toBe(15);
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

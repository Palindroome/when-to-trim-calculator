// "Warunki": the opt-in fill of temperature and humidity from the Open-Meteo forecast (stubbed).
import { expect, type Page, test } from '@playwright/test';
import { field, NOW, openApp, setNight, snapshot } from './helpers';

const WEATHER_HOSTS = /(api|geocoding-api)\.open-meteo\.com/;
const PLACE_KEY = 'kiedy-trymowac-weather-place';
const FETCH = 'Pobierz z prognozy pogody';

/** 48 hourly values from local midnight of NOW: 4 °C / 70 % by day, -2 °C / 90 % at night (22–7). */
function forecastBody(): unknown {
  const midnight = Date.parse(NOW) / 1000 - 9 * 3600;
  const time = Array.from({ length: 48 }, (_, i) => midnight + i * 3600);
  const night = (i: number): boolean => i % 24 >= 22 || i % 24 < 7;
  return {
    hourly: {
      time,
      temperature_2m: time.map((_, i) => (night(i) ? -2 : 4)),
      relative_humidity_2m: time.map((_, i) => (night(i) ? 90 : 70)),
    },
  };
}

const GEOCODING = {
  results: [{ name: 'Kraków', admin1: 'Małopolskie', latitude: 50.06143, longitude: 19.93658 }],
};

/** Stubs both Open-Meteo hosts and records every request to them. */
async function stubWeather(
  page: Page,
  forecast: 'ok' | 'error' | 'offline' = 'ok',
): Promise<string[]> {
  const requests: string[] = [];
  await page.route(WEATHER_HOSTS, async (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.includes('geocoding-api')) return route.fulfill({ json: GEOCODING });
    if (forecast === 'offline') return route.abort('internetdisconnected');
    if (forecast === 'error') return route.fulfill({ status: 500, json: { error: true } });
    return route.fulfill({ json: forecastBody() });
  });
  return requests;
}

const conditionsSummary = (page: Page) => page.locator('[data-step]').nth(1).locator('.summary');
const status = (page: Page) => page.locator('.wx-status');
const values = (page: Page, ids: string[]) =>
  page.evaluate(
    (list) => list.map((id) => (document.getElementById(id) as HTMLInputElement).value),
    ids,
  );

test.describe('weather forecast fill', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.2297, longitude: 21.0122 });
  });

  test('sends nothing before the click, then fills the day values from the next 24 h', async ({
    page,
  }) => {
    const requests = await stubWeather(page);
    await openApp(page);
    await expect(page.getByText('Dane pogodowe:')).toBeVisible();
    await expect(
      page.getByText(/wysyłamy do Open-Meteo\.com przybliżoną lokalizację/),
    ).toBeVisible();
    const before = await snapshot(page);
    await field(page, 'Temperatura w pracowni').fill('20');
    expect(requests).toEqual([]);

    await page.getByRole('button', { name: FETCH }).click();
    // 15 day hours at 4 °C / 70 % and 9 night hours at -2 °C / 90 %, all averaged while night mode is off
    await expect(field(page, 'Temperatura w pracowni')).toHaveValue('2');
    await expect(field(page, 'Wilgotność powietrza')).toHaveValue('78');
    expect(await values(page, ['ntemp', 'nrh', 'dtemp', 'drh'])).toEqual(['15', '60', '15', '88']);
    expect(requests).toHaveLength(1);
    const q = new URL(requests[0]!).searchParams;
    expect([q.get('latitude'), q.get('longitude'), q.get('timezone')]).toEqual([
      '52.2',
      '21',
      'auto',
    ]);
    expect(q.get('hourly')).toBe('temperature_2m,relative_humidity_2m');

    await expect(status(page)).toHaveText('≈ z prognozy (na zewnątrz), śr 4.03 09:00');
    await expect(conditionsSummary(page)).toHaveText(/^2 °C, 78%/);
    expect((await snapshot(page)).big).not.toBe(before.big);

    // the values stay editable; editing one makes it the user's own again
    await field(page, 'Wilgotność powietrza').fill('55');
    await expect(status(page)).toHaveText('');
    await expect(conditionsSummary(page)).toHaveText(/^2 °C, 55%/);
  });

  test('fills the night values only while the night switch is on', async ({ page }) => {
    await stubWeather(page);
    await openApp(page);
    await setNight(page, true);
    await page.getByRole('button', { name: FETCH }).click();
    await expect(field(page, 'Temperatura nocą (22–7)')).toHaveValue('-2');
    expect(await values(page, ['temp', 'rh', 'ntemp', 'nrh', 'dtemp', 'drh'])).toEqual([
      '4',
      '70',
      '-2',
      '90',
      '15',
      '88',
    ]);
    await expect(conditionsSummary(page)).toHaveText(/noc -2 °C, 90%/);
  });

  test('keeps the values and the hint across a language switch', async ({ page }) => {
    await stubWeather(page);
    await openApp(page);
    await page.getByRole('button', { name: FETCH }).click();
    await expect(field(page, 'Temperatura w pracowni')).toHaveValue('2');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await values(page, ['temp', 'rh'])).toEqual(['2', '78']);
    await expect(status(page)).toHaveText('≈ from the forecast (outdoors), Wed 4 Mar 09:00');
    await expect(page.getByText('Weather data:')).toBeVisible();
  });

  test('offers a town search when the location is denied, and remembers the town', async ({
    page,
    context,
  }) => {
    await context.clearPermissions();
    const requests = await stubWeather(page);
    await openApp(page);
    await page.getByRole('button', { name: FETCH }).click();
    await expect(status(page)).toHaveText('Nie udało się ustalić lokalizacji. Wpisz miejscowość.');
    const town = page.getByLabel('Miejscowość', { exact: true });
    await expect(town).toBeFocused();
    await town.fill('Krak');
    await town.press('Enter');
    await page.getByRole('button', { name: 'Kraków, Małopolskie' }).click();
    await expect(field(page, 'Temperatura w pracowni')).toHaveValue('2');
    await expect(town).toBeHidden();
    expect(new URL(requests[0]!).searchParams.get('language')).toBe('pl');
    const q = new URL(requests[1]!).searchParams;
    expect([q.get('latitude'), q.get('longitude')]).toEqual(['50.1', '19.9']);
    expect(
      JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PLACE_KEY)) ?? 'null'),
    ).toEqual({ name: 'Kraków, Małopolskie', lat: 50.1, lon: 19.9 });
    await expect(page.getByText('Miejsce: Kraków, Małopolskie')).toBeVisible();

    // the next fill uses the remembered town; "forget" removes it
    await field(page, 'Temperatura w pracowni').fill('20');
    await page.getByRole('button', { name: FETCH }).click();
    await expect(field(page, 'Temperatura w pracowni')).toHaveValue('2');
    expect(requests).toHaveLength(3);
    await page.getByRole('button', { name: 'Zapomnij miejsce' }).click();
    await expect(page.getByText('Miejsce: Kraków, Małopolskie')).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), PLACE_KEY)).toBeNull();
  });

  test('fits a 320 px screen with the town search open', async ({ page, context }) => {
    await context.clearPermissions();
    await stubWeather(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await openApp(page);
    await page.getByRole('button', { name: FETCH }).click();
    const town = page.getByLabel('Miejscowość', { exact: true });
    await town.fill('Krak');
    await town.press('Enter');
    await expect(page.getByRole('button', { name: 'Kraków, Małopolskie' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });

  test('shows a service error and leaves the values', async ({ page }) => {
    await stubWeather(page, 'error');
    await openApp(page);
    const before = await snapshot(page);
    await page.getByRole('button', { name: FETCH }).click();
    await expect(status(page)).toHaveText(
      'Serwis pogodowy nie odpowiedział poprawnie. Wartości bez zmian.',
    );
    expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
    expect(await snapshot(page)).toEqual(before);
  });

  test('shows an offline error in English and leaves the values', async ({ page }) => {
    await stubWeather(page, 'offline');
    await openApp(page);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Fill from the weather forecast' }).click();
    await expect(status(page)).toHaveText(
      'The weather service could not be reached. Values unchanged.',
    );
    expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
  });
});

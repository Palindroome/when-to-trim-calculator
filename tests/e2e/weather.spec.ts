// "Warunki": the opt-in fill of temperature and humidity from the Open-Meteo forecast, for a point picked on
// an OpenStreetMap map. Every external host is stubbed.
import { expect, type Page, test } from '@playwright/test';
import { field, NOW, openApp, setNight, snapshot } from './helpers';

const WEATHER_HOSTS = /(api|geocoding-api)\.open-meteo\.com/;
const TILES = /tile\.openstreetmap\.org/;
const PLACE_KEY = 'kiedy-trymowac-weather-place';
const FETCH = 'Pobierz z prognozy pogody';
/** a 1×1 transparent PNG for every map tile */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** 48 hourly values from local midnight of 4 March: 4 °C / 70 % by day, -2 °C / 90 % at night (22–7). */
function forecastBody(): unknown {
  const midnight = Date.parse('2026-03-04T00:00:00+01:00') / 1000;
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

interface Traffic {
  /** Open-Meteo requests (forecast and geocoding) */
  weather: string[];
  tiles: string[];
  /** every request of the page, to spot the lazy map chunk */
  all: string[];
}

/** Stubs the Open-Meteo hosts and the OSM tiles and records the requests. */
async function stubNetwork(
  page: Page,
  forecast: 'ok' | 'error' | 'offline' = 'ok',
): Promise<Traffic> {
  const traffic: Traffic = { weather: [], tiles: [], all: [] };
  page.on('request', (r) => traffic.all.push(r.url()));
  await page.route(WEATHER_HOSTS, async (route) => {
    const url = route.request().url();
    traffic.weather.push(url);
    if (url.includes('geocoding-api')) return route.fulfill({ json: GEOCODING });
    if (forecast === 'offline') return route.abort('internetdisconnected');
    if (forecast === 'error') return route.fulfill({ status: 500, json: { error: true } });
    return route.fulfill({ json: forecastBody() });
  });
  await page.route(TILES, async (route) => {
    traffic.tiles.push(route.request().url());
    return route.fulfill({ contentType: 'image/png', body: PNG });
  });
  return traffic;
}

/** Opens the app at `now`, then lets the clock run on from there, which Leaflet's pan animations need. */
async function open(page: Page, now = NOW): Promise<void> {
  await openApp(page, { now });
  await page.clock.setSystemTime(new Date(now));
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Wskaż miejsce prognozy' });
const confirmButton = (page: Page) => page.getByRole('button', { name: 'Zatwierdź' });
const pinText = (page: Page) => page.locator('.wx-pin');
const conditionsSummary = (page: Page) => page.locator('[data-step]').nth(1).locator('.summary');
const status = (page: Page) => page.locator('.wx-status');
const values = (page: Page, ids: string[]) =>
  page.evaluate(
    (list) => list.map((id) => (document.getElementById(id) as HTMLInputElement).value),
    ids,
  );
const forecastQuery = (traffic: Traffic): URLSearchParams[] =>
  traffic.weather.filter((u) => u.includes('/v1/forecast')).map((u) => new URL(u).searchParams);
const storedPlace = async (page: Page): Promise<unknown> =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PLACE_KEY)) ?? 'null');

async function openDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: FETCH }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator('#wx-map .leaflet-tile-loaded').first()).toBeAttached();
}

test.describe('weather forecast fill', () => {
  test.describe('with the location allowed', () => {
    test.beforeEach(async ({ context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 52.2297, longitude: 21.0122 });
    });

    test('loads no map, tile or forecast before the click', async ({ page }) => {
      const traffic = await stubNetwork(page);
      await open(page);
      await expect(page.getByText('Dane pogodowe:')).toBeVisible();
      await expect(
        page.getByText(/kafelki pobieramy z serwerów OpenStreetMap.*najbliższe 12 h/),
      ).toBeVisible();
      await field(page, 'Temperatura w pracowni').fill('21');
      expect(traffic.weather).toEqual([]);
      expect(traffic.tiles).toEqual([]);
      expect(traffic.all.filter((u) => /map-picker|leaflet/i.test(u))).toEqual([]);

      await openDialog(page);
      expect(traffic.all.filter((u) => /map-picker.*\.js/.test(u))).toHaveLength(1);
      expect(traffic.tiles.length).toBeGreaterThan(0);
      // the map shows the OSM attribution and the dialog repeats the privacy note
      await expect(dialog(page).getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
        'href',
        'https://www.openstreetmap.org/copyright',
      );
      await expect(dialog(page).getByText(/widzi Twój adres IP/)).toBeVisible();
      expect(traffic.weather).toEqual([]);
    });

    test('puts the pin on the location and fills the next 12 h after Zatwierdź', async ({
      page,
    }) => {
      const traffic = await stubNetwork(page);
      await open(page);
      const before = await snapshot(page);
      await openDialog(page);
      await expect(page.getByLabel('Miejscowość', { exact: true })).toBeFocused();
      await expect(pinText(page)).toHaveText('Pinezka: 52,2° N, 21,0° E');
      await expect(page.locator('#wx-map .wx-marker')).toBeVisible();
      expect(traffic.weather).toEqual([]);

      await confirmButton(page).click();
      await expect(dialog(page)).toBeHidden();
      await expect(page.getByRole('button', { name: FETCH })).toBeFocused();
      // 09:00–20:00 is all day: 4 °C / 70 %
      await expect(field(page, 'Temperatura w pracowni')).toHaveValue('4');
      await expect(field(page, 'Wilgotność powietrza')).toHaveValue('70');
      expect(await values(page, ['ntemp', 'nrh', 'dtemp', 'drh'])).toEqual([
        '15',
        '60',
        '15',
        '88',
      ]);
      const [q] = forecastQuery(traffic);
      expect([q?.get('latitude'), q?.get('longitude'), q?.get('timezone')]).toEqual([
        '52.2',
        '21',
        'auto',
      ]);
      expect(q?.get('hourly')).toBe('temperature_2m,relative_humidity_2m');
      await expect(status(page)).toHaveText('≈ z prognozy (na zewnątrz), śr 4.03 09:00');
      await expect(conditionsSummary(page)).toHaveText(/^4 °C, 70%/);
      expect((await snapshot(page)).big).not.toBe(before.big);
      expect(await storedPlace(page)).toEqual({ name: '52,2° N, 21,0° E', lat: 52.2, lon: 21 });
      await expect(page.getByText('Miejsce: 52,2° N, 21,0° E')).toBeVisible();

      // the values stay editable; editing one makes it the user's own again
      await field(page, 'Wilgotność powietrza').fill('55');
      await expect(status(page)).toHaveText('');
      await expect(conditionsSummary(page)).toHaveText(/^4 °C, 55%/);
    });

    test('fills the night values while the night switch is on', async ({ page }) => {
      await stubNetwork(page);
      // 13:00–00:00: 22 and 23 are night hours
      await open(page, '2026-03-04T13:00:00+01:00');
      await setNight(page, true);
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Pinezka: 52,2° N, 21,0° E');
      await confirmButton(page).click();
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

    test('keeps the night values when the window has no night hours, and says so', async ({
      page,
    }) => {
      await stubNetwork(page);
      // 08:00–19:00 has no night hour
      await open(page, '2026-03-04T08:00:00+01:00');
      await setNight(page, true);
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Pinezka: 52,2° N, 21,0° E');
      await confirmButton(page).click();
      await expect(field(page, 'Temperatura w pracowni')).toHaveValue('4');
      expect(await values(page, ['temp', 'rh', 'ntemp', 'nrh'])).toEqual(['4', '70', '15', '60']);
      await expect(status(page)).toHaveText(
        '≈ z prognozy (na zewnątrz), śr 4.03 08:00 Wartości nocne bez zmian – brak godzin nocnych w najbliższych 12 h.',
      );
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await expect(status(page)).toHaveText(
        '≈ from the forecast (outdoors), Wed 4 Mar 08:00 Night values unchanged – no night hours in the next 12 h.',
      );
    });

    test('keeps the values and the hint across a language switch', async ({ page }) => {
      await stubNetwork(page);
      await open(page);
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Pinezka: 52,2° N, 21,0° E');
      await confirmButton(page).click();
      await expect(field(page, 'Temperatura w pracowni')).toHaveValue('4');
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect(await values(page, ['temp', 'rh'])).toEqual(['4', '70']);
      await expect(status(page)).toHaveText('≈ from the forecast (outdoors), Wed 4 Mar 09:00');
      await expect(page.getByText('Weather data:')).toBeVisible();
      await expect(page.getByText(/OpenStreetMap servers.*next 12 h/)).toBeVisible();
    });

    test('shows a service error and leaves the values', async ({ page }) => {
      await stubNetwork(page, 'error');
      await open(page);
      const before = await snapshot(page);
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Pinezka: 52,2° N, 21,0° E');
      await confirmButton(page).click();
      await expect(status(page)).toHaveText(
        'Serwis pogodowy nie odpowiedział poprawnie. Wartości bez zmian.',
      );
      expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
      expect(await snapshot(page)).toEqual(before);
    });

    test('shows an offline error in English and leaves the values', async ({ page }) => {
      await stubNetwork(page, 'offline');
      await open(page);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('button', { name: 'Fill from the weather forecast' }).click();
      await expect(page.getByRole('dialog', { name: 'Choose the forecast place' })).toBeVisible();
      await expect(pinText(page)).toHaveText('Pin: 52.2° N, 21.0° E');
      await page.getByRole('button', { name: 'Confirm' }).click();
      await expect(status(page)).toHaveText(
        'The weather service could not be reached. Values unchanged.',
      );
      expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
    });
  });

  test.describe('with the location denied', () => {
    test('opens on Poland without a pin; a map click places it and a drag moves it', async ({
      page,
    }) => {
      const traffic = await stubNetwork(page);
      await open(page);
      await openDialog(page);
      await expect(dialog(page).locator('.wx-dstatus')).toHaveText(
        'Nie udało się ustalić lokalizacji – wskaż miejsce na mapie.',
      );
      await expect(confirmButton(page)).toBeDisabled();
      await expect(pinText(page)).toHaveText('Brak pinezki – kliknij mapę.');
      await expect(page.locator('#wx-map .wx-marker')).toHaveCount(0);

      const map = page.locator('#wx-map');
      const box = (await map.boundingBox())!;
      await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
      await expect(confirmButton(page)).toBeEnabled();
      const clicked = (await pinText(page).textContent()) ?? '';
      expect(clicked).toMatch(/^Pinezka: 5\d,\d° N, 1\d,\d° E$/);

      // drag the pin 120 px to the east
      const marker = (await page.locator('#wx-map .wx-marker').boundingBox())!;
      const [x, y] = [marker.x + marker.width / 2, marker.y + marker.height / 2];
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 60, y, { steps: 5 });
      await page.mouse.move(x + 120, y, { steps: 5 });
      await page.mouse.up();
      await expect(pinText(page)).not.toHaveText(clicked);
      const lonOf = (text: string): number =>
        Number(/, (\d+,\d)° E/.exec(text)![1]!.replace(',', '.'));
      const dragged = (await pinText(page).textContent()) ?? '';
      expect(lonOf(dragged)).toBeGreaterThan(lonOf(clicked) + 1);

      await confirmButton(page).click();
      const [q] = forecastQuery(traffic);
      expect(Number(q?.get('longitude'))).toBe(lonOf(dragged));
      await expect(field(page, 'Temperatura w pracowni')).toHaveValue('4');
    });

    test('a search result only pans and zooms the map', async ({ page }) => {
      const traffic = await stubNetwork(page);
      await open(page);
      await openDialog(page);
      const town = page.getByLabel('Miejscowość', { exact: true });
      await town.fill('Krak');
      await town.press('Enter');
      await page.getByRole('button', { name: 'Kraków, Małopolskie' }).click();
      expect(new URL(traffic.weather[0]!).searchParams.get('language')).toBe('pl');
      await expect
        .poll(() => traffic.tiles.filter((u) => /\/11\/\d+\/\d+\.png$/.test(u)).length)
        .toBeGreaterThan(0);
      await expect(pinText(page)).toHaveText('Brak pinezki – kliknij mapę.');
      await expect(confirmButton(page)).toBeDisabled();
      expect(forecastQuery(traffic)).toEqual([]);
      expect(await storedPlace(page)).toBeNull();
      expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
    });

    for (const how of ['Anuluj', 'Escape'] as const) {
      test(`${how} closes the dialog, sends nothing and returns focus`, async ({ page }) => {
        const traffic = await stubNetwork(page);
        await open(page);
        await openDialog(page);
        await page.locator('#wx-map').click({ position: { x: 100, y: 100 } });
        await expect(confirmButton(page)).toBeEnabled();
        if (how === 'Anuluj') await page.getByRole('button', { name: 'Anuluj' }).click();
        else await page.keyboard.press('Escape');
        await expect(dialog(page)).toBeHidden();
        await expect(page.getByRole('button', { name: FETCH })).toBeFocused();
        expect(traffic.weather).toEqual([]);
        expect(await storedPlace(page)).toBeNull();
        expect(await values(page, ['temp', 'rh'])).toEqual(['20', '50']);
      });
    }

    test('opens on a remembered place with its pin; "Zapomnij miejsce" clears it', async ({
      page,
    }) => {
      // a town stored by the first version, which picked it from the search results
      await page.addInitScript((key) => {
        if (!sessionStorage.getItem('__place')) {
          localStorage.setItem(key, JSON.stringify({ name: 'Kraków', lat: 50.1, lon: 19.9 }));
          sessionStorage.setItem('__place', '1');
        }
      }, PLACE_KEY);
      const traffic = await stubNetwork(page);
      await open(page);
      await expect(page.getByText('Miejsce: Kraków')).toBeVisible();
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Pinezka: 50,1° N, 19,9° E');
      await expect(confirmButton(page)).toBeEnabled();
      await page.getByRole('button', { name: 'Anuluj' }).click();
      expect(traffic.weather).toEqual([]);

      await page.getByRole('button', { name: 'Zapomnij miejsce' }).click();
      await expect(page.getByText('Miejsce: Kraków')).toBeHidden();
      expect(await storedPlace(page)).toBeNull();
      await openDialog(page);
      await expect(pinText(page)).toHaveText('Brak pinezki – kliknij mapę.');
    });

    test('works from the keyboard: Tab to the map, pan, pin at the centre, Zatwierdź', async ({
      page,
    }) => {
      const traffic = await stubNetwork(page);
      await open(page);
      await openDialog(page);
      const map = page.locator('#wx-map');
      for (let i = 0; i < 5 && !(await map.evaluate((e) => e === document.activeElement)); i++) {
        await page.keyboard.press('Tab');
      }
      await expect(map).toBeFocused();
      // Leaflet ignores arrow keys while a pan is still animating
      const settled = () =>
        expect(map.locator('.leaflet-pan-anim, .leaflet-zoom-anim')).toHaveCount(0);
      for (const key of ['ArrowRight', 'ArrowRight', '+']) {
        await page.keyboard.press(key);
        await settled();
      }
      const centre = page.getByRole('button', { name: 'Postaw pinezkę na środku mapy' });
      for (
        let i = 0;
        i < 10 && !(await centre.evaluate((e) => e === document.activeElement));
        i++
      ) {
        await page.keyboard.press('Tab');
      }
      await expect(centre).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(pinText(page)).toHaveText(/^Pinezka: /);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(confirmButton(page)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(field(page, 'Temperatura w pracowni')).toHaveValue('4');
      // Poland is centred near 19.2° E; two 80 px steps east move the map by about 3.5°
      const [q] = forecastQuery(traffic);
      expect(Number(q?.get('longitude'))).toBeGreaterThan(20.5);
    });

    test('fits a 320 px screen with the dialog open', async ({ page }) => {
      await stubNetwork(page);
      await page.setViewportSize({ width: 320, height: 640 });
      await open(page);
      await openDialog(page);
      const town = page.getByLabel('Miejscowość', { exact: true });
      await town.fill('Krak');
      await town.press('Enter');
      await expect(page.getByRole('button', { name: 'Kraków, Małopolskie' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      const box = (await dialog(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(box.y + box.height).toBeLessThanOrEqual(640);
      for (const name of ['Zatwierdź', 'Anuluj', 'Postaw pinezkę na środku mapy', 'Szukaj']) {
        const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
    });
  });
});

// A light-hearted extra line in the result for temperatures above 50 °C or below −50 °C (#69).
import { expect, test } from '@playwright/test';
import { fill, openApp, setNight, snapshot } from './helpers';

const HOT_PL = 'Ponad 50 °C? Jestem pod wrażeniem, że jeszcze nic się tu nie roztopiło.';
const COLD_PL = 'Poniżej −50 °C? Glina zamarzła na kamień, a garncarz chyba razem z nią.';
const HOT_EN = "Over 50 °C? I'm impressed you haven't melted yet.";
const COLD_EN = 'Below −50 °C? The clay is frozen solid, and the potter probably too.';

test.describe('extreme temperature jokes', () => {
  test('51 °C adds the hot joke next to the unchanged recommendation or warning', async ({
    page,
  }) => {
    await openApp(page);
    await fill(page, 'Temperatura w pracowni', '51');
    const jokes = page.locator('#result .rec .joke');
    await expect(jokes).toHaveText([HOT_PL]);
    const s = await snapshot(page);
    expect(s.kind).not.toBe('');
    expect(s.big).not.toBe('');
    expect(s.jokes).toEqual([HOT_PL]);
    // the joke is an addition: the rest of the result is what it is without it
    await jokes.evaluate((el) => el.remove());
    const { jokes: _, ...rest } = s;
    expect(await snapshot(page)).toEqual(rest);
  });

  test('exactly 50 °C and −50 °C show no joke', async ({ page }) => {
    await openApp(page);
    for (const value of ['50', '-50']) {
      await fill(page, 'Temperatura w pracowni', value);
      await expect(page.locator('#result .rec .k')).toBeVisible();
      await expect(page.locator('#result .joke')).toHaveCount(0);
    }
  });

  test('−51 °C shows the cold joke', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Temperatura w pracowni', '-51');
    await expect(page.locator('#result .rec .joke')).toHaveText([COLD_PL]);
    await expect(page.locator('#result .rec .big')).not.toBeEmpty();
  });

  test('the night temperature counts only while night is on; the damp room always counts', async ({
    page,
  }) => {
    await openApp(page);
    await setNight(page, true);
    await fill(page, 'Temperatura nocą (22–7)', '60');
    await expect(page.locator('#result .joke')).toHaveText([HOT_PL]);
    await setNight(page, false);
    await expect(page.locator('#result .joke')).toHaveCount(0);
    await fill(page, 'Mokra przechowalnia: temp.', '-60');
    await expect(page.locator('#result .joke')).toHaveText([COLD_PL]);
    await fill(page, 'Temperatura w pracowni', '60');
    await expect(page.locator('#result .joke')).toHaveText([HOT_PL, COLD_PL]);
  });

  test('the jokes follow the language switch', async ({ page }) => {
    await openApp(page);
    await fill(page, 'Temperatura w pracowni', '51');
    await fill(page, 'Mokra przechowalnia: temp.', '-51');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#result .joke')).toHaveText([HOT_EN, COLD_EN]);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const width of [320, 375, 1280]) {
      test(`${width}px ${colorScheme}: both jokes fit without horizontal overflow`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 800 });
        await openApp(page);
        await fill(page, 'Temperatura w pracowni', '51');
        await fill(page, 'Mokra przechowalnia: temp.', '-51');
        await expect(page.locator('#result .joke')).toHaveCount(2);
        for (const box of await page
          .locator('#result .joke')
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right)))
          expect(box).toBeLessThanOrEqual(width);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });
    }
  }
});

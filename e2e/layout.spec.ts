import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

test.describe('layout', () => {
  test('desktop: centred 640px column, two-column form grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    const box = await page.locator('main').boundingBox();
    expect(box?.width).toBe(640);
    expect(box?.x).toBe((1280 - 640) / 2);
    const cols = await page.locator('.grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(' ')).toHaveLength(2);
    const bar = await page.locator('.bar').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(bar).toMatch(/^118px \S+ 74px$/);
  });

  test('phone: narrower bar columns', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openApp(page);
    const bar = await page.locator('.bar').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(bar).toMatch(/^96px \S+ 66px$/);
  });

  test('result block sits between "Termin" and "Sprawdź wagą"', async ({ page }) => {
    await openApp(page);
    const order = await page.locator('main > section').evaluateAll((els) =>
      els.map((e) => (e.id ? `#${e.id}` : (e.querySelector('h2')?.textContent ?? e.querySelector('summary')?.textContent ?? '').trim())),
    );
    expect(order).toEqual(['1Praca', '2Warunki', '3Termin', '#result', '4Sprawdź wagą', '5Moje prace i kalibracja', 'Jak to liczy (i czego jeszcze nie umie)']);
  });

  test('on-target bars are highlighted', async ({ page }) => {
    await openApp(page);
    await page.locator('#quick').getByRole('button', { name: 'jutro' }).click();
    await expect(page.locator('.bar .fill.good')).toHaveCount(1);
    await expect(page.locator('.bar').filter({ has: page.locator('.fill.good') })).toContainText('Worek częściowo');
  });
});

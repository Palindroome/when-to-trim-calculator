import { expect, test } from '@playwright/test';
import { fill, openApp } from './helpers';

test.describe('layout', () => {
  test.describe('page columns', () => {
    test('1280px: the result is sticky in the right column and stays in view', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openApp(page);
      const form = (await page.locator('main > section.card').first().boundingBox())!;
      const result = (await page.locator('#result .rec').boundingBox())!;
      expect(result.x).toBeGreaterThanOrEqual(form.x + form.width);
      expect(Math.abs(result.y - form.y)).toBeLessThan(2);
      const thrown = (await page.locator('#thrown-day').boundingBox())!;
      const when = (await page.locator('#when-day').boundingBox())!;
      expect(when.y).toBe(thrown.y);
      expect(when.x).toBeGreaterThan(thrown.x + thrown.width);

      // at the end of <main> the whole result is inside the window
      await page.evaluate(() => document.querySelector('main')!.scrollIntoView({ block: 'end' }));
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
      const atMainEnd = await page.locator('#result').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
      expect(atMainEnd.top).toBeGreaterThanOrEqual(0);
      expect(atMainEnd.bottom).toBeLessThanOrEqual(900);

      // after scrolling to "5 Moje prace", and at the very end of the page, the result stays above the site
      // footer and inside the window, moved up by no more than the part of the footer that is in view
      for (const scroll of [
        () => document.getElementById('pieces')!.closest('section')!.scrollIntoView({ block: 'start' }),
        () => window.scrollTo(0, document.documentElement.scrollHeight),
      ]) {
        await page.evaluate(scroll);
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
        const r = await page.locator('#result').evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
        const footerTop = await page.locator('footer').evaluate((el) => el.getBoundingClientRect().top);
        expect(r.top).toBeGreaterThanOrEqual(Math.min(0, footerTop - 900));
        expect(r.bottom).toBeLessThanOrEqual(Math.min(900, footerTop));
      }
    });

    for (const width of [1023, 768, 375]) {
      test(`${width}px: one column, result below "Termin"`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openApp(page);
        const cards = page.locator('main > section');
        const first = (await cards.nth(0).boundingBox())!;
        const termin = (await cards.nth(2).boundingBox())!;
        const result = (await page.locator('#result').boundingBox())!;
        expect(result.x).toBeCloseTo(first.x, 0);
        expect(result.width).toBeCloseTo(first.width, 0);
        expect(result.y).toBeGreaterThan(termin.y + termin.height - 1);
      });
    }
  });

  for (const [width, height] of [[320, 640], [375, 812], [414, 896], [480, 900]] as const) {
    test(`${width}px: no horizontal scroll, date-time controls fully visible and 44px high`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openApp(page);
      // reveal the "other date" inputs too, so they are measured
      for (const id of ['thrown', 'when']) await page.locator(`#${id}-day`).selectOption('other');
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      const controls = page.locator('.datetime').locator('select, input, button');
      expect(await controls.count()).toBe(2 * 3 + 4 + 5);
      for (const box of await controls.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(clientWidth);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      // the time field shows the whole HH:MM
      for (const id of ['#thrown-time', '#when-time']) {
        expect(await page.locator(id).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
    });
  }

  for (const width of [320, 340, 360, 375, 414, 480, 1280]) {
    test(`${width}px: every day option fits the day select, in Polish and English`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      // two-digit days and month ends give the longest labels, e.g. "yesterday · Tue 24 Feb"
      await openApp(page, { now: '2026-02-25T09:00:00+01:00' });
      await page.evaluate(() => document.fonts.ready);
      for (const lang of ['Polski', 'English'] as const) {
        await page.getByRole('button', { name: lang, exact: true }).click();
        const overflow = await page.locator('#thrown-day, #when-day').evaluateAll((selects) =>
          selects.flatMap((el) => {
            const s = getComputedStyle(el);
            const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
            const ctx = document.createElement('canvas').getContext('2d')!;
            ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
            return [...(el as HTMLSelectElement).options]
              .filter((o) => ctx.measureText(o.text).width > room)
              .map((o) => `${el.id}: "${o.text}" > ${room}px`);
          }),
        );
        expect(overflow).toEqual([]);
      }
    });
  }

  test('result block sits between "Termin" and "Sprawdź wagą"', async ({ page }) => {
    await openApp(page);
    const order = await page.locator('main > section').evaluateAll((els) =>
      els.map((e) => (e.id ? `#${e.id}` : (e.querySelector('h2')?.textContent ?? e.querySelector('summary')?.textContent ?? '').trim())),
    );
    expect(order).toEqual(['1Praca', '2Warunki', '3Termin', '#result', '4Sprawdź wagą', '5Moje prace i kalibracja', 'Jak to liczy (i czego jeszcze nie umie)']);
  });

  test('phone: a long piece name keeps the status badge on its row', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openApp(page);
    await fill(page, 'Nazwa (opcjonalnie)', 'Bardzo długa nazwa pracy na czwartkowe kubki z uchem');
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    // both boxes in one evaluate, so they share one scroll offset while the list is still smooth-scrolling into view
    const { name, badge } = await page.locator('#pieces .piece .top').evaluate((top) => ({
      name: top.querySelector('b')!.getBoundingClientRect().toJSON() as DOMRect,
      badge: top.querySelector('.badge')!.getBoundingClientRect().toJSON() as DOMRect,
    }));
    // beside the name: vertically overlapping it and to its right, not on a line of its own
    expect(badge.y + badge.height).toBeGreaterThan(name.y);
    expect(badge.y).toBeLessThan(name.y + name.height);
    expect(badge.x).toBeGreaterThanOrEqual(name.x + name.width);
  });

  test('on-target bars are highlighted', async ({ page }) => {
    await openApp(page);
    await page.locator('#quick').getByRole('button', { name: 'jutro' }).click();
    await expect(page.locator('.bar .fill.good')).toHaveCount(1);
    await expect(page.locator('.bar').filter({ has: page.locator('.fill.good') })).toContainText('Worek częściowo');
  });
});

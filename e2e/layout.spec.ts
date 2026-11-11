import { expect, type Locator, type Page, test } from '@playwright/test';
import { fill, openApp, setDateTime } from './helpers';

test.describe('layout', () => {
  test.describe('page columns', () => {
    test('1280px: the result is sticky in the right column and stays in view', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openApp(page);
      const form = (await page.locator('main > section.card').first().boundingBox())!;
      const result = (await page.locator('#result .rec').boundingBox())!;
      expect(result.x).toBeGreaterThanOrEqual(form.x + form.width);
      expect(Math.abs(result.y - form.y)).toBeLessThan(2);
      const thrown = (await page.locator('#thrown-day-btn').boundingBox())!;
      const when = (await page.locator('#when-day-btn').boundingBox())!;
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

  const pageFits = async (page: Page): Promise<number> => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    return clientWidth;
  };
  const expectInside = async (boxes: DOMRect[], clientWidth: number, clientHeight = Infinity): Promise<void> => {
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(clientWidth);
      expect(box.y + box.height).toBeLessThanOrEqual(clientHeight);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  };
  const rects = (l: Locator): Promise<DOMRect[]> => l.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));

  for (const [width, height] of [
    [320, 640],
    [375, 812],
    [414, 896],
    [480, 900],
    [1280, 900],
  ] as const) {
    test(`${width}px: no horizontal scroll, date-time controls and the open calendar fully visible, 44px targets`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openApp(page);
      const clientWidth = await pageFits(page);
      const controls = page.locator('.dt-row button, .dt-row input:not([type="hidden"]), .chips button');
      expect(await controls.count()).toBe(2 * 2 + 4 + 5);
      await expectInside(await rects(controls), clientWidth);
      // the time field shows the whole HH:MM
      for (const id of ['#thrown-time', '#when-time']) {
        expect(await page.locator(id).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      }
      for (const id of ['thrown', 'when']) {
        await page.locator(`#${id}-day-btn`).click();
        const dialog = page.locator(`#${id}-cal`);
        await expect(dialog).toBeVisible();
        await pageFits(page);
        const [box] = await rects(dialog);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(clientWidth);
        expect(box!.y + box!.height).toBeLessThanOrEqual(height);
        // every day and both paging buttons are inside the window and at least 44px
        const targets = dialog.locator(
          'calendar-month button[part~="day"], calendar-date [part~="previous"], calendar-date [part~="next"]',
        );
        expect(await targets.count()).toBeGreaterThanOrEqual(28 + 2);
        await expectInside(await rects(targets), clientWidth, height);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      }
    });
  }

  for (const width of [320, 340, 360, 375, 414, 480, 1280]) {
    test(`${width}px: the day button shows the whole day, in Polish and English`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      // the longest labels: a relative word, a two-digit day and a wide month, e.g. "yesterday · Mon 24 May"
      await openApp(page, { now: '2027-05-25T09:00:00+02:00' });
      await page.evaluate(() => document.fonts.ready);
      await setDateTime(page, 'Wytoczona', '2027-05-24T09:00');
      await setDateTime(page, 'Chcę trymować', '2027-05-24T10:00');
      for (const [lang, label] of [
        ['Polski', 'wczoraj · pn 24.05'],
        ['English', 'yesterday · Mon 24 May'],
      ] as const) {
        await page.getByRole('button', { name: lang, exact: true }).click();
        for (const id of ['#thrown-day-text', '#when-day-text']) {
          await expect(page.locator(id)).toHaveText(label);
          expect(await page.locator(id).evaluate((el) => el.scrollWidth <= el.clientWidth), `${id} ${label}`).toBe(true);
        }
      }
    });
  }

  test('result block sits between "Termin" and "Sprawdź wagą"', async ({ page }) => {
    await openApp(page);
    const order = await page
      .locator('main > section')
      .evaluateAll((els) =>
        els.map((e) => (e.id ? `#${e.id}` : (e.querySelector('h2')?.textContent ?? e.querySelector('summary')?.textContent ?? '').trim())),
      );
    expect(order).toEqual([
      '1Praca',
      '2Warunki',
      '3Termin',
      '#result',
      '4Sprawdź wagą',
      '5Moje prace i kalibracja',
      'Jak to liczy (i czego jeszcze nie umie)',
    ]);
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

import type { Page } from '@playwright/test';
import { fill, setNight } from './helpers';

/** Page states used by the screenshot and design checks. */
export const STATES: Record<string, (page: Page) => Promise<void>> = {
  default: async () => {},
  'night-weight': async (page) => {
    await setNight(page, true);
    await fill(page, 'Masa teraz', '490');
  },
  error: async (page) => {
    await fill(page, 'Chcę trymować', '2026-03-01T10:00');
  },
  'tips-and-pieces': async (page) => {
    await page.getByLabel('Kształt', { exact: true }).selectOption('closed');
    await page.getByLabel('Ruch powietrza przy półce', { exact: true }).selectOption('draft');
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.clock.setFixedTime(new Date('2026-03-06T11:00:00+01:00'));
    await page.getByRole('button', { name: 'w sam raz' }).click();
    await page.getByRole('button', { name: 'za tydzień' }).click();
    await page.getByRole('button', { name: 'Zapisz tę pracę z planem' }).click();
    await page.locator('details summary').click();
    await page.evaluate(() => window.scrollTo(0, 0));
  },
};

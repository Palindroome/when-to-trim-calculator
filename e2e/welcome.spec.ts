// Welcome screen: first visit and after an hour without interaction; saved pieces are never touched.
import { expect, test, type Page } from '@playwright/test';
import { ACTIVITY_KEY, NOW, STORAGE_KEY, openApp } from './helpers';

const MIN = 60 * 1000;
const at = (offsetMin: number): Date => new Date(Date.parse(NOW) + offsetMin * MIN);

const screen = (page: Page) => page.locator('.welcome-screen');
const heading = (page: Page) => page.getByRole('heading', { name: 'Zaplanuj suszenie pracy' });
const newPiece = (page: Page) => screen(page).getByRole('button', { name: 'Nowa praca' });
const myPieces = (page: Page) => page.getByRole('button', { name: /^Moje prace \(\d+\)$/ });
const bar = (page: Page) => page.locator('.wizard-bar');
const backToWelcome = (page: Page) => bar(page).getByRole('button', { name: 'Nowa praca' });
const PRIVACY_PL =
  'Twoje prace zapisują się w tej przeglądarce na tym urządzeniu i zostają po jej zamknięciu. Znikną tylko, jeśli wyczyścisz dane przeglądania. Nigdzie ich nie wysyłamy.';
const PRIVACY_EN =
  "Your pieces are saved in this browser on this device and stay after you close it. They're removed only if you clear your browsing data. We don't send them anywhere.";
const explainer = (page: Page) => page.locator('main > section:has(details)');
const rows = (page: Page) => page.locator('#welcome-list > li');
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.trim());

const PIECE = {
  id: 'abc',
  name: 'miski',
  start: Date.parse('2026-03-03T12:00:00+01:00'),
  mass: 800,
  lossPct: 6,
  plan: [{ w: 'box', h: null }],
  label: 'Włóż do zamkniętego pudełka od razu.',
  dom: 'box',
  predH: 100,
  calUsed: 1,
  ws: 90,
  we: 120,
  fb: null,
};
const DATA = JSON.stringify({ pieces: [PIECE] });
/** waiting (ready in 79 h), ready (forecast passed) and rated */
const THREE = JSON.stringify({
  pieces: [
    PIECE,
    { ...PIECE, id: 'def', name: 'talerze', predH: 10 },
    { ...PIECE, id: 'ghi', name: 'kubki', fb: { kind: 'ok', actualH: 20, sample: 1, at: Date.parse('2026-03-04T08:00:00+01:00') } },
  ],
});

async function expectCollapsedPage(page: Page): Promise<void> {
  await expect(screen(page)).toBeHidden();
  await expect(page.locator('main > section[data-step]')).toHaveCount(3);
  for (const card of await page.locator('main > section[data-step]').all()) await expect(card).toHaveClass(/\bcollapsed\b/);
  await expect(page.locator('#mass')).toBeHidden();
  await expect(page.locator('main > section[data-step] .summary').first()).toBeVisible();
}

/** Records the last interaction `minutesAgo` before NOW, as an earlier visit would have. */
async function lastActive(page: Page, minutesAgo: number): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [ACTIVITY_KEY, String(at(-minutesAgo).getTime())] as const,
  );
}

async function expectWelcome(page: Page): Promise<void> {
  await expect(screen(page)).toBeVisible();
  await expect(heading(page)).toBeFocused();
  await expect(page.locator('main > section:visible')).toHaveCount(0);
  for (const sel of ['main > section[data-step]', '#result', '.lead', '.wizard-bar']) {
    for (const el of await page.locator(sel).all()) await expect(el).toHaveAttribute('inert', '');
  }
  await expect(page.locator('.masthead')).toBeVisible();
}

async function expectNoWelcome(page: Page): Promise<void> {
  await expect(screen(page)).toBeHidden();
  await expect(page.locator('#mass')).toBeVisible();
  await expect(page.locator('[inert]')).toHaveCount(0);
}

test.describe('welcome screen', () => {
  test('first visit: explanation, three steps, privacy line; only the masthead around it', async ({ page }) => {
    await openApp(page, { wizard: true, welcome: true });
    await expectWelcome(page);
    await expect(screen(page).locator('p').first()).toHaveText(
      'Kalkulator szacuje, kiedy świeżo wytoczona praca będzie gotowa do kolejnego etapu: doklejania uch, trymowania albo rzeźbienia.',
    );
    await expect(screen(page)).not.toContainText(/skórzast/i);
    await expect(screen(page)).not.toContainText(/po trymowaniu/i);
    await expect(screen(page).getByRole('heading', { name: 'Jak to działa' })).toBeVisible();
    await expect(screen(page).locator('ol > li')).toHaveCount(3);
    await expect(screen(page)).toContainText(PRIVACY_PL);
    await expect(screen(page)).not.toContainText('tylko w tej przeglądarce');
    await expect(explainer(page)).toContainText(`${PRIVACY_PL} W kolejnej wersji temperaturę i wilgotność mogą wpisywać czujniki BLE`);
    await expect(explainer(page)).not.toContainText('tylko w tej przeglądarce');
    await expect(myPieces(page)).toHaveCount(0);
    // the form behind it is not reachable by keyboard
    await page.keyboard.press('Tab');
    expect(await focused(page)).toBe('welcome-new');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('main > :not(.masthead):not(.welcome-screen)') ?? null)).toBeNull();
    }
  });

  test('"Nowa praca" opens the wizard at step 1 with fresh inputs', async ({ page }) => {
    await openApp(page, { welcome: true });
    await newPiece(page).click();
    await expect(screen(page)).toBeHidden();
    await expect(page.locator('#wizard-progress')).toHaveText('Krok 1 z 3: Praca');
    await expect(page.locator('main > section:visible h2')).toHaveText('1Praca');
    await expect(page.locator('main > section[data-step] h2').first()).toBeFocused();
    expect(await stored(page, ACTIVITY_KEY)).toBe(String(Date.parse(NOW)));
  });

  test('within the threshold there is no welcome screen', async ({ page }) => {
    await lastActive(page, 30);
    await openApp(page, { welcome: true });
    await expectNoWelcome(page);
  });

  test("after more than an hour it returns; a piece's details open section 5 with 1–3 collapsed; the pieces are intact", async ({
    page,
  }) => {
    await lastActive(page, 61);
    await openApp(page, { welcome: true, storage: DATA });
    await expectWelcome(page);
    expect(await stored(page, STORAGE_KEY)).toBe(DATA);
    await myPieces(page).click();
    await page.getByRole('button', { name: 'Szczegóły: miski' }).click();
    await expectCollapsedPage(page);
    const piece = page.locator('#pieces .piece[data-piece="abc"]');
    await expect(piece).toBeFocused();
    await expect(piece).toBeInViewport();
    await expect(page.locator('#pieces .piece b')).toHaveText(['miski']);
    expect(await stored(page, STORAGE_KEY)).toBe(DATA);
  });

  test('"Moje prace (N)" is a disclosure listing each piece with its highlights', async ({ page }) => {
    await openApp(page, { welcome: true, storage: THREE });
    const button = myPieces(page);
    await expect(button).toHaveText('Moje prace (3)');
    await expect(button).toHaveAttribute('aria-controls', 'welcome-list');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#welcome-list')).toBeHidden();
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveText('Moje prace (3)');
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).locator('b')).toHaveText(['miski', 'talerze', 'kubki']);
    // thrown, forecast and state, worded as in section 5
    for (const row of await rows(page).all()) await expect(row.locator('.meta')).toHaveText(/^Toczona .+ · prognoza .+$/);
    await expect(rows(page).locator('.badge')).toHaveText([/^za /, 'powinna być gotowa', /^w sam raz · po /]);
    const listed = await rows(page).locator('.badge').allTextContents();
    await page.getByRole('button', { name: 'Szczegóły: kubki' }).click();
    await expect(page.locator('#pieces .piece .badge')).toHaveText(listed);
    await expectCollapsedPage(page);
    await expect(page.locator('#pieces .piece[data-piece="ghi"]')).toBeFocused();
    await expect(page.locator('#pieces .piece[data-piece="ghi"]')).toBeInViewport();
  });

  test('the disclosure works by keyboard', async ({ page }) => {
    await openApp(page, { welcome: true, storage: THREE });
    await expect(heading(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(myPieces(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(myPieces(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(rows(page)).toHaveCount(3);
    await page.keyboard.press('Space');
    await expect(myPieces(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#welcome-list')).toBeHidden();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Szczegóły: miski' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectCollapsedPage(page);
    await expect(page.locator('#pieces .piece[data-piece="def"]')).toBeFocused();
  });

  test('the bar holds only "Nowa praca", on the left, outside and inside the wizard', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#wizard-open')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Przeprowadź mnie krok po kroku' })).toHaveCount(0);
    await expect(bar(page).getByRole('button')).toHaveCount(1);
    const expectFirstOnLeft = async (): Promise<void> => {
      await expect(bar(page).locator('button:visible').first()).toHaveText('Nowa praca');
      const b = (await backToWelcome(page).boundingBox())!;
      const box = (await bar(page).boundingBox())!;
      expect(Math.abs(b.x - box.x)).toBeLessThan(1);
    };
    await expectFirstOnLeft();
    await backToWelcome(page).click();
    await newPiece(page).click();
    // inside the wizard: progress text and "Pomiń" unchanged, "Nowa praca" still first
    await expect(page.locator('#wizard-progress')).toHaveText('Krok 1 z 3: Praca');
    await expect(bar(page).getByRole('button', { name: 'Pomiń – pokaż cały formularz' })).toBeVisible();
    await expect(bar(page).getByRole('button')).toHaveText(['Nowa praca', 'Pomiń – pokaż cały formularz']);
    await expectFirstOnLeft();
  });

  test('"Nowa praca" on the working page shows the welcome screen again, from the form and from the wizard', async ({ page }) => {
    await openApp(page, { storage: DATA });
    await expectNoWelcome(page);
    await backToWelcome(page).click();
    await expectWelcome(page);
    await expect(myPieces(page)).toHaveAttribute('aria-expanded', 'false');
    await newPiece(page).click();
    await expect(page.locator('#wizard-progress')).toHaveText('Krok 1 z 3: Praca');
    await backToWelcome(page).click();
    await expectWelcome(page);
    await myPieces(page).click();
    await page.getByRole('button', { name: 'Szczegóły: miski' }).click();
    await expectCollapsedPage(page);
    await backToWelcome(page).click();
    await expectWelcome(page);
    // the list starts collapsed each time the screen is shown
    await expect(myPieces(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#welcome-list')).toBeHidden();
  });

  test('interacting records the time under its own key; the pieces store stays byte-identical', async ({ page }) => {
    await openApp(page, { welcome: true, storage: DATA });
    expect(await stored(page, ACTIVITY_KEY)).toBeNull();
    await newPiece(page).click();
    expect(await stored(page, ACTIVITY_KEY)).toBe(String(Date.parse(NOW)));
    await page.clock.setFixedTime(at(2));
    await page.locator('#mass').fill('600');
    expect(await stored(page, ACTIVITY_KEY)).toBe(String(at(2).getTime()));
    expect(await stored(page, STORAGE_KEY)).toBe(DATA);
  });

  test('returning to a tab after more than an hour shows it again; sooner it does not', async ({ page }) => {
    await openApp(page);
    await page.locator('#mass').fill('700');
    const returnToTab = async (min: number): Promise<void> => {
      await page.clock.setFixedTime(at(min));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    };
    await returnToTab(30);
    await expectNoWelcome(page);
    await returnToTab(30 + 61);
    await expectWelcome(page);
    // a new piece starts from fresh defaults, thrown "now"
    await newPiece(page).click();
    await expect(page.locator('#mass')).toHaveValue('500');
    await expect(page.locator('#thrown-day')).toHaveValue('2026-03-04');
    await expect(page.locator('#thrown-time')).toHaveValue('10:31');
  });

  test('a restored page (bfcache pageshow) after more than an hour shows it', async ({ page }) => {
    await openApp(page);
    await page.clock.setFixedTime(at(61));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expectWelcome(page);
  });

  test('the language switch works on the welcome screen and keeps it shown', async ({ page }) => {
    await openApp(page, { welcome: true, storage: DATA });
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Plan your piece’s drying' })).toBeVisible();
    await expect(screen(page).locator('p').first()).toHaveText(
      'The calculator estimates when a freshly thrown piece will be ready for the next stage: attaching handles, trimming or carving.',
    );
    await expect(screen(page)).not.toContainText(/leather-hard/i);
    await expect(screen(page)).toContainText('How it works');
    await expect(screen(page)).toContainText(PRIVACY_EN);
    await expect(screen(page)).not.toContainText('only in this browser');
    await expect(explainer(page)).toContainText(`${PRIVACY_EN} In a later version, BLE sensors`);
    await expect(explainer(page)).not.toContainText('only in this browser');
    await expect(page.getByRole('button', { name: 'New piece' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'My pieces (1)' })).toBeVisible();
    await expect(page.locator('main > section:visible')).toHaveCount(0);
    await page.getByRole('button', { name: 'My pieces (1)' }).click();
    await expect(page.getByRole('button', { name: 'Details: miski' })).toHaveText('Details');
    await expect(rows(page).locator('.meta')).toHaveText(/^Thrown .+ · forecast .+$/);
    await page.getByRole('button', { name: 'New piece' }).click();
    await expect(page.locator('#wizard-progress')).toHaveText('Step 1 of 3: Piece');
    await expect(page.locator('.wizard-bar').getByRole('button')).toHaveText(['New piece', 'Skip – show the full form']);
    await page.locator('.wizard-bar').getByRole('button', { name: 'New piece' }).click();
    await expect(page.getByRole('heading', { name: 'Plan your piece’s drying' })).toBeFocused();
  });
});

const noOverflow = async (page: Page): Promise<void> => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
};

for (const width of [320, 375, 1280]) {
  test(`${width}px: the welcome screen and its pieces list fit without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openApp(page, { welcome: true, storage: THREE });
    await expect(screen(page)).toBeVisible();
    await myPieces(page).click();
    await expect(rows(page)).toHaveCount(3);
    await noOverflow(page);
    for (const b of await screen(page).getByRole('button').all()) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Szczegóły: kubki' }).click();
    await expect(backToWelcome(page)).toBeVisible();
    await noOverflow(page);
  });
}

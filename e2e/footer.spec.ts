// Site footer: the author's profile links, where to report a problem, and the licence.
import { expect, type Page, test } from '@playwright/test';
import { openApp, tokenContrast } from './helpers';

const GITHUB = 'https://github.com/Palindroome';
const INSTAGRAM = 'https://www.instagram.com/palindroom/';
const ISSUES = 'https://github.com/Palindroome/when-to-trim-calculator/issues/new';
const LICENCE = 'https://github.com/Palindroome/when-to-trim-calculator/blob/main/LICENSE';

const links = (page: Page) => {
  const footer = page.getByRole('contentinfo');
  return { footer, github: footer.getByRole('link', { name: /^GitHub/ }), instagram: footer.getByRole('link', { name: /^Instagram/ }) };
};

/** The contact and licence links in the footer's sentences, Polish names. */
const textLinks = (page: Page) => {
  const footer = page.getByRole('contentinfo');
  return [
    footer.getByRole('link', { name: 'Zgłoś problem na GitHubie', exact: true }),
    footer.getByRole('link', { name: 'napisz na Instagramie', exact: true }),
    footer.getByRole('link', { name: 'licencji MIT', exact: true }),
  ];
};

test.describe('site footer', () => {
  test('is a contentinfo landmark outside <main> with both profile links', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await openApp(page);
    const { footer, github, instagram } = links(page);
    await expect(footer).toHaveCount(1);
    expect(await footer.evaluate((el) => el.closest('main') === null)).toBe(true);
    await expect(footer.getByRole('navigation', { name: 'Autor w sieci' })).toBeVisible();
    await expect(github).toHaveAttribute('href', GITHUB);
    await expect(instagram).toHaveAttribute('href', INSTAGRAM);
    await expect(github).toHaveAccessibleName('GitHub – profil autora');
    await expect(instagram).toHaveAccessibleName('Instagram – profil autora (@palindroom)');
    for (const [link, text] of [
      [github, 'GitHub'],
      [instagram, 'Instagram'],
    ] as const) {
      await expect(link).toHaveText(text);
      await expect(link.locator('svg')).toHaveCount(1);
      await expect(link.locator('svg[aria-hidden="true"][focusable="false"]')).toHaveCount(1);
      await expect(link.locator('svg [fill="currentColor"]')).toHaveCount(1);
      await expect(link.locator('img')).toHaveCount(0);
    }
    // icons are inline: nothing is fetched from another origin
    const origin = new URL(page.url()).origin;
    expect(requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:'))).toEqual([]);
  });

  test('switching to English updates the labels without a reload', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
    await page.getByRole('button', { name: 'English' }).click();
    const { footer, github, instagram } = links(page);
    await expect(footer.getByRole('navigation', { name: 'Author online' })).toBeVisible();
    await expect(github).toHaveAccessibleName('GitHub – author’s profile');
    await expect(instagram).toHaveAccessibleName('Instagram – author’s profile (@palindroom)');
    await expect(github).toHaveAttribute('href', GITHUB);
    await expect(instagram).toHaveAttribute('href', INSTAGRAM);
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    await expect(footer.getByRole('link', { name: 'Report a problem on GitHub', exact: true })).toHaveAttribute('href', ISSUES);
    await expect(footer.getByRole('link', { name: 'send a message on Instagram', exact: true })).toHaveAttribute('href', INSTAGRAM);
    await expect(footer.getByRole('link', { name: 'MIT licence', exact: true })).toHaveAttribute('href', LICENCE);
    await expect(footer).toContainText(
      'Something not working, or does a result look wrong? Report a problem on GitHub or send a message on Instagram.',
    );
    await expect(footer).toContainText('The calculator is free to use under the MIT licence.');
  });

  test('invites problem reports on GitHub or Instagram and links the MIT licence', async ({ page }) => {
    await openApp(page);
    const footer = page.getByRole('contentinfo');
    const [report, message, licence] = textLinks(page);
    await expect(report!).toHaveAttribute('href', ISSUES);
    await expect(message!).toHaveAttribute('href', INSTAGRAM);
    await expect(licence!).toHaveAttribute('href', LICENCE);
    await expect(footer).toContainText('Coś nie działa albo wynik wygląda na błędny? Zgłoś problem na GitHubie lub napisz na Instagramie.');
    await expect(footer).toContainText('Z kalkulatora można korzystać bezpłatnie na licencji MIT.');
    // links inside the sentences are underlined, not told apart by colour alone
    for (const l of [report!, message!, licence!]) {
      expect(await l.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('underline');
    }
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${colorScheme} scheme`, () => {
      test.use({ colorScheme });

      test('links are keyboard-focusable with a visible ring, and text and icons have enough contrast', async ({ page }) => {
        await openApp(page);
        const { github } = links(page);
        await github.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(github).toBeFocused();
        const outline = await github.evaluate((el) => getComputedStyle(el).outlineStyle);
        expect(outline).toBe('solid');
        // link text and icon (currentColor) use --text-muted, on the page background --bg
        const colours = await github.evaluate((el) => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--text-muted)';
          document.body.append(probe);
          const muted = getComputedStyle(probe).color;
          probe.remove();
          return { link: getComputedStyle(el).color, icon: getComputedStyle(el.querySelector('svg')!).color, muted };
        });
        expect(colours.link).toBe(colours.muted);
        expect(colours.icon).toBe(colours.muted);
        expect(await tokenContrast(page, '--text-muted', '--bg')).toBeGreaterThanOrEqual(4.5);
        expect(await tokenContrast(page, '--ring', '--bg')).toBeGreaterThanOrEqual(3);
      });
    });
  }

  for (const [width, height] of [
    [320, 640],
    [375, 812],
  ] as const) {
    test.describe(`${width}px phone (coarse pointer)`, () => {
      test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

      test('no horizontal scroll, links inside the viewport and at least 44px tall, in both languages', async ({ page }) => {
        await openApp(page);
        expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(true);
        for (const lang of ['pl', 'en']) {
          if (lang === 'en') await page.getByRole('button', { name: 'English' }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          const all = page.getByRole('contentinfo').getByRole('link');
          await expect(all).toHaveCount(5);
          for (const link of await all.all()) {
            const box = (await link.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      });
    });
  }

  test('fine pointer: links are at least 32px tall', async ({ page }) => {
    await openApp(page);
    const { github, instagram } = links(page);
    for (const link of [github, instagram]) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  });

  test('1280px: spans the content width below both columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApp(page);
    const bottom = (sel: string) =>
      page
        .locator(sel)
        .last()
        .evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    const footerBox = await page
      .getByRole('contentinfo')
      .locator('ul')
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, left: r.left, right: r.right };
      });
    expect(footerBox.top).toBeGreaterThanOrEqual(await bottom('#result'));
    expect(footerBox.top).toBeGreaterThanOrEqual(await bottom('main > section.card'));
    // same left and right edges as the content: the form column on the left, the result column on the right
    const form = (await page.locator('main > section.card').first().boundingBox())!;
    const rec = (await page.locator('#result .rec').boundingBox())!;
    expect(footerBox.left).toBeCloseTo(form.x, 0);
    expect(footerBox.right).toBeCloseTo(rec.x + rec.width, 0);
  });
});

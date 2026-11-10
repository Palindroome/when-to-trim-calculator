import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { renderFooter } from './footer';

describe('renderFooter', () => {
  it('links to both profiles, each with one decorative inline SVG', () => {
    const html = renderFooter(pl);
    expect(html).toContain('href="https://github.com/Palindroome"');
    expect(html).toContain('href="https://www.instagram.com/palindroom/"');
    expect(html.match(/<svg [^>]*aria-hidden="true"[^>]*focusable="false"/g)).toHaveLength(2);
    expect(html.match(/fill="currentColor"/g)).toHaveLength(2);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('target=');
  });

  it('offers problem reports on GitHub or Instagram and links the MIT licence', () => {
    for (const m of [pl, en]) {
      const html = renderFooter(m);
      expect(html).toContain(`<a href="https://github.com/Palindroome/when-to-trim-calculator/issues/new">${m.footer.report}</a>`);
      expect(html).toContain(`<a href="https://www.instagram.com/palindroom/">${m.footer.message}</a>`);
      expect(html).toContain(`<a href="https://github.com/Palindroome/when-to-trim-calculator/blob/main/LICENSE">${m.footer.licence}</a>`);
    }
    expect(renderFooter(pl)).toContain('Coś nie działa albo wynik wygląda na błędny?');
    expect(renderFooter(en)).toContain('free to use under the');
  });

  it('takes its labels from the catalog', () => {
    for (const m of [pl, en]) {
      const html = renderFooter(m);
      expect(html).toContain(`<nav aria-label="${m.footer.label}">`);
      expect(html).toContain(`aria-label="${m.footer.githubLabel}"`);
      expect(html).toContain(`aria-label="${m.footer.instagramLabel}"`);
    }
  });
});

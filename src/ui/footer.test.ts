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

  it('takes its labels from the catalog', () => {
    for (const m of [pl, en]) {
      const html = renderFooter(m);
      expect(html).toContain(`<nav aria-label="${m.footer.label}">`);
      expect(html).toContain(`aria-label="${m.footer.githubLabel}"`);
      expect(html).toContain(`aria-label="${m.footer.instagramLabel}"`);
    }
  });
});

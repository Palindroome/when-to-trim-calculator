import { describe, expect, it } from 'vitest';
import { pl } from '../../../src/i18n/pl';
import { markup } from '../../../src/ui/features/conditions/conditions';
import { markup as weatherMarkup } from '../../../src/ui/features/conditions/weather';

describe('"Warunki" markup', () => {
  it('has no weather fill without a weather provider', () => {
    const plain = markup(pl, false);
    expect(plain).not.toMatch(/weather|wx-|open-meteo/i);
    // with one, the fill is the only addition, right after the humidity field
    expect(markup(pl, true)).toBe(
      plain.replace(
        '<span>%</span></div></div>',
        `<span>%</span></div></div>\n      ${weatherMarkup(pl)}`,
      ),
    );
  });

  it('shows the privacy note and the attribution next to the button', () => {
    const html = weatherMarkup(pl);
    expect(html).toContain(pl.weather.fetch);
    expect(html).toContain(pl.weather.note);
    expect(html).toContain('href="https://open-meteo.com/"');
    expect(html).toContain('aria-live="polite"');
  });
});

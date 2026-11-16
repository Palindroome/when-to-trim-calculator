import { describe, expect, it } from 'vitest';
import { en } from '../../../src/i18n/en';
import { pl } from '../../../src/i18n/pl';
import { markup } from '../../../src/ui/features/conditions/conditions';
import { markup as weatherMarkup } from '../../../src/ui/features/conditions/weather';

describe('"Warunki" markup', () => {
  it('has no weather fill without a weather provider', () => {
    const plain = markup(pl, null);
    expect(plain).not.toMatch(/weather|wx-|open-meteo|openstreetmap/i);
    // with one, the fill is the only addition, right after the humidity field
    expect(markup(pl, 12)).toBe(
      plain.replace(
        '<span>%</span></div></div>',
        `<span>%</span></div></div>\n      ${weatherMarkup(pl, 12)}`,
      ),
    );
  });

  it('shows the privacy note with the window length and the attribution next to the button', () => {
    const html = weatherMarkup(pl, 12);
    expect(html).toContain(pl.weather.fetch);
    expect(html).toContain(pl.weather.note(12));
    expect(pl.weather.note(12)).toMatch(/OpenStreetMap.*Open-Meteo\.com.*najbliższe 12 h/);
    expect(en.weather.note(6)).toMatch(/OpenStreetMap.*Open-Meteo\.com.*next 6 h/);
    expect(html).toContain('href="https://open-meteo.com/"');
    expect(html).toContain('aria-live="polite"');
  });

  it('has a labelled modal dialog with a confirm button that starts disabled', () => {
    const html = weatherMarkup(pl, 12);
    expect(html).toContain('<dialog class="wx-dialog" id="wx-dialog" aria-labelledby="wx-title">');
    // h3: a heading inside section 2, whose own h2 the wizard and the tests look up
    expect(html).toContain(`<h3 id="wx-title">${pl.weather.mapTitle}</h3>`);
    expect(html).toMatch(/id="wx-ok" disabled>Zatwierdź</);
  });
});

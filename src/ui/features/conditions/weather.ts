// "Warunki": the opt-in fill of temperature and humidity from a weather forecast. Nothing is sent before the click.
import { forecastConditions, type Place } from '../../../domain/weather';
import type { Messages } from '../../../i18n';
import { clearPlace, loadPlace, savePlace } from '../../../storage/preferences';
import { WeatherError, type WeatherProvider } from '../../../weather/provider';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';

const GEOLOCATION: PositionOptions = { timeout: 10_000, maximumAge: 30 * 60 * 1000 };

/** The last fill: when, and the values written by field id. Kept across re-renders (language switch). */
let filled: { at: number; values: Record<string, string> } | null = null;
/** true while the fill dispatches its own `input` events */
let filling = false;

export function markup(m: Messages): string {
  const w = m.weather;
  return `<div class="full weather">
        <button type="button" class="ghost" id="wx-fetch">${w.fetch}</button>
        <p class="muted">${w.note}</p>
        <p class="muted">${w.attribution} <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>
        <p class="wx-place hide"><span></span> <button type="button" class="ghost" id="wx-forget">${w.forget}</button></p>
        <div class="wx-search hide">
          <label for="wx-q">${w.searchLabel}</label>
          <div class="wx-row"><input id="wx-q" type="search" autocomplete="off" placeholder="${esc(w.searchPlaceholder)}"><button type="button" class="ghost" id="wx-find">${w.search}</button></div>
          <ul class="wx-results"></ul>
        </div>
        <p class="wx-status" role="status" aria-live="polite"></p>
      </div>`;
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  if (ctx.weather) wire(root, ctx, ctx.weather);
}

function wire(root: HTMLElement, ctx: AppContext, provider: WeatherProvider): void {
  // the requests are asynchronous and the page may be re-rendered meanwhile: always look up the current elements
  const el = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(`.weather ${sel}`)!;
  const w = (): Messages['weather'] => ctx.view.m.weather;
  const say = (text: string): void => {
    el('.wx-status').textContent = text;
  };
  const sayError = (e: unknown): void =>
    say(w().errors[e instanceof WeatherError ? e.kind : 'service']);
  let places: Place[] = [];

  function showPlace(): void {
    const place = loadPlace();
    el('.wx-place').classList.toggle('hide', !place);
    el('.wx-place span').textContent = place ? w().place(place.name) : '';
  }

  function offerSearch(): void {
    el('.wx-search').classList.remove('hide');
    say(w().errors.location);
    el('#wx-q').focus();
  }

  async function fill(lat: number, lon: number): Promise<void> {
    say(w().loading);
    try {
      const forecast = await provider.forecast(lat, lon);
      const night = byId<HTMLInputElement>('night').checked;
      const c = forecastConditions(forecast, ctx.now(), night, ctx.view.params);
      if (c.temp === null && c.rh === null) throw new WeatherError('service');
      const values: Record<string, string> = {};
      const fields = { temp: c.temp, rh: c.rh, ntemp: c.nightTemp, nrh: c.nightRh };
      for (const [id, v] of Object.entries(fields)) if (v !== null) values[id] = String(v);
      filling = true;
      try {
        for (const [id, v] of Object.entries(values)) {
          const input = byId<HTMLInputElement>(id);
          input.value = v;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } finally {
        filling = false;
      }
      filled = { at: ctx.now(), values };
      say(w().filled(ctx.view.fmt.dateTime(filled.at)));
    } catch (e) {
      sayError(e);
    }
  }

  function locate(): void {
    const place = loadPlace();
    if (place) {
      void fill(place.lat, place.lon);
    } else if (!('geolocation' in navigator)) {
      offerSearch();
    } else {
      say(w().loading);
      navigator.geolocation.getCurrentPosition(
        (pos) => void fill(pos.coords.latitude, pos.coords.longitude),
        offerSearch,
        GEOLOCATION,
      );
    }
  }

  async function search(): Promise<void> {
    const name = el<HTMLInputElement>('#wx-q').value.trim();
    if (!name) return;
    el('.wx-results').innerHTML = '';
    say(w().searching);
    try {
      places = await provider.searchPlace(name, ctx.view.m.lang);
      el('.wx-results').innerHTML = places
        .map(
          (p, i) =>
            `<li><button type="button" class="ghost" data-place="${i}">${esc(p.name)}</button></li>`,
        )
        .join('');
      say(places.length ? '' : w().noResults);
    } catch (e) {
      sayError(e);
    }
  }

  function choose(place: Place): void {
    savePlace(place);
    el('.wx-search').classList.add('hide');
    el('.wx-results').innerHTML = '';
    showPlace();
    void fill(place.lat, place.lon);
  }

  showPlace();
  const kept = filled;
  if (
    kept &&
    Object.entries(kept.values).every(([id, v]) => byId<HTMLInputElement>(id).value === v)
  ) {
    say(w().filled(ctx.view.fmt.dateTime(kept.at)));
  } else {
    filled = null;
  }

  const box = root.querySelector<HTMLElement>('.weather')!;
  box.addEventListener('click', (e) => {
    if (closest(e, '#wx-fetch')) locate();
    else if (closest(e, '#wx-find')) void search();
    else if (closest(e, '#wx-forget')) {
      clearPlace();
      showPlace();
    } else {
      const choice = closest(e, '[data-place]');
      const place = choice && places[Number(choice.dataset.place)];
      if (place) choose(place);
    }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && closest(e, '#wx-q')) {
      e.preventDefault();
      void search();
    }
  });
  // editing a filled field by hand makes the values the user's own again
  root.querySelector('#body-2')!.addEventListener('input', (e) => {
    const id = e.target instanceof HTMLElement ? e.target.id : '';
    if (!filling && filled && id in filled.values) {
      filled = null;
      say('');
    }
  });
}

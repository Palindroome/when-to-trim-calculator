// "Warunki": the opt-in fill of temperature and humidity from a weather forecast, for a point picked on a map.
// Nothing is sent before the click, and the forecast only after the point is confirmed.
import { forecastConditions } from '../../../domain/weather';
import type { Messages } from '../../../i18n';
import { clearPlace, loadPlace, savePlace } from '../../../storage/preferences';
import { roundCoord, WeatherError, type WeatherProvider } from '../../../weather/provider';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import type { MapPicker, Point } from './map-picker';

const GEOLOCATION: PositionOptions = { timeout: 10_000, maximumAge: 30 * 60 * 1000 };

/** A field group the last fill left unchanged because the forecast window had no hours for it. */
type Kept = keyof Messages['weather']['kept'];

/** The last fill: when, the values written by field id and the group kept. Kept across re-renders (language switch). */
let filled: { at: number; values: Record<string, string>; kept: Kept | null } | null = null;
/** true while the fill dispatches its own `input` events */
let filling = false;

/** `hours`: the forecast window, named in the privacy note. */
export function markup(m: Messages, hours: number): string {
  const w = m.weather;
  return `<div class="full weather">
        <button type="button" class="ghost" id="wx-fetch" aria-haspopup="dialog" aria-controls="wx-dialog">${w.fetch}</button>
        <p class="muted">${w.note(hours)}</p>
        <p class="muted">${w.attribution} <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a></p>
        <p class="wx-place hide"><span></span> <button type="button" class="ghost" id="wx-forget">${w.forget}</button></p>
        <p class="wx-status" role="status" aria-live="polite"></p>
        <dialog class="wx-dialog" id="wx-dialog" aria-labelledby="wx-title">
          <h3 id="wx-title">${w.mapTitle}</h3>
          <p class="muted">${w.mapNote}</p>
          <label for="wx-q">${w.searchLabel}</label>
          <div class="wx-row"><input id="wx-q" type="search" autocomplete="off" placeholder="${esc(w.searchPlaceholder)}"><button type="button" class="ghost" id="wx-find">${w.search}</button></div>
          <ul class="wx-results"></ul>
          <p class="wx-dstatus" role="status" aria-live="polite"></p>
          <div class="wx-map" id="wx-map" role="application" aria-label="${esc(w.map)}"></div>
          <p class="wx-pin" aria-live="polite"></p>
          <div class="wx-actions">
            <button type="button" class="ghost" id="wx-centre">${w.pinAtCentre}</button>
            <button type="button" class="ghost" id="wx-cancel">${w.cancel}</button>
            <button type="button" class="main" id="wx-ok" disabled>${w.confirm}</button>
          </div>
        </dialog>
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
  /** status inside the dialog: location, search and map messages */
  const sayInDialog = (text: string): void => {
    el('.wx-dstatus').textContent = text;
  };
  const errorText = (e: unknown): string =>
    w().errors[e instanceof WeatherError ? e.kind : 'service'];
  const dialog = el<HTMLDialogElement>('#wx-dialog');
  let places: Point[] = [];
  let picker: MapPicker | null = null;
  let pin: Point | null = null;
  /** counts dialog openings, so a map that finishes loading after the dialog closed is dropped */
  let opens = 0;

  function showPlace(): void {
    const place = loadPlace();
    el('.wx-place').classList.toggle('hide', !place);
    el('.wx-place span').textContent = place ? w().place(place.name) : '';
  }

  function hint(): string {
    if (!filled) return '';
    const done = w().filled(ctx.view.fmt.dateTime(filled.at));
    return filled.kept ? `${done} ${w().kept[filled.kept](ctx.view.params.forecastHours)}` : done;
  }

  async function fill(lat: number, lon: number): Promise<void> {
    say(w().loading);
    try {
      const forecast = await provider.forecast(lat, lon);
      const night = byId<HTMLInputElement>('night').checked;
      const c = forecastConditions(forecast, ctx.now(), night, ctx.view.params);
      const fields = { temp: c.temp, rh: c.rh, ntemp: c.nightTemp, nrh: c.nightRh };
      const values: Record<string, string> = {};
      for (const [id, v] of Object.entries(fields)) if (v !== null) values[id] = String(v);
      if (!Object.keys(values).length) throw new WeatherError('service');
      // a group with no hours in the window keeps its values, and the hint says so
      const kept: Kept | null =
        c.temp === null && c.rh === null
          ? 'day'
          : night && c.nightTemp === null && c.nightRh === null
            ? 'night'
            : null;
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
      filled = { at: ctx.now(), values, kept };
      say(hint());
    } catch (e) {
      say(errorText(e));
    }
  }

  function showPin(p: Point): void {
    pin = p;
    el('.wx-pin').textContent = w().pin(ctx.view.fmt.coords(roundCoord(p.lat), roundCoord(p.lon)));
    el<HTMLButtonElement>('#wx-ok').disabled = false;
  }

  /** Opens the dialog on the remembered place (pin on it) or on Poland, then tries the browser location. */
  async function openDialog(): Promise<void> {
    const opening = ++opens;
    pin = null;
    places = [];
    el('.wx-results').innerHTML = '';
    el('.wx-pin').textContent = w().noPin;
    sayInDialog('');
    el<HTMLButtonElement>('#wx-ok').disabled = true;
    dialog.showModal();
    el('#wx-q').focus();
    let created: MapPicker;
    try {
      const { createMapPicker } = await import('./map-picker');
      // closed, or closed and opened again, while the map code loaded
      if (opening !== opens || !dialog.open) return;
      const place = loadPlace();
      created = createMapPicker(
        el('#wx-map'),
        place && { lat: place.lat, lon: place.lon },
        showPin,
      );
    } catch {
      sayInDialog(w().errors.map);
      return;
    }
    picker = created;
    const failed = (): void => {
      if (picker === created) sayInDialog(w().errors.location);
    };
    if (!('geolocation' in navigator)) {
      failed();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (picker === created)
          created.locate({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      failed,
      GEOLOCATION,
    );
  }

  /** Zatwierdź: remember the rounded point, close the dialog and fetch its forecast. */
  function confirm(): void {
    if (!pin) return;
    const lat = roundCoord(pin.lat);
    const lon = roundCoord(pin.lon);
    savePlace({ name: ctx.view.fmt.coords(lat, lon), lat, lon });
    showPlace();
    dialog.close();
    void fill(lat, lon);
  }

  async function search(): Promise<void> {
    const name = el<HTMLInputElement>('#wx-q').value.trim();
    if (!name) return;
    el('.wx-results').innerHTML = '';
    sayInDialog(w().searching);
    try {
      const found = await provider.searchPlace(name, ctx.view.m.lang);
      places = found;
      el('.wx-results').innerHTML = found
        .map(
          (p, i) =>
            `<li><button type="button" class="ghost" data-place="${i}">${esc(p.name)}</button></li>`,
        )
        .join('');
      sayInDialog(found.length ? '' : w().noResults);
    } catch (e) {
      sayInDialog(errorText(e));
    }
  }

  showPlace();
  const last = filled;
  if (
    last &&
    Object.entries(last.values).every(([id, v]) => byId<HTMLInputElement>(id).value === v)
  ) {
    say(hint());
  } else {
    filled = null;
  }

  const box = root.querySelector<HTMLElement>('.weather')!;
  box.addEventListener('click', (e) => {
    if (closest(e, '#wx-fetch')) void openDialog();
    else if (closest(e, '#wx-forget')) {
      clearPlace();
      showPlace();
    } else if (closest(e, '#wx-find')) void search();
    else if (closest(e, '#wx-centre')) picker?.pinAtCentre();
    else if (closest(e, '#wx-ok')) confirm();
    else if (closest(e, '#wx-cancel')) dialog.close();
    else {
      // a search result only moves the map: the pin, the stored place and the form stay
      const choice = closest(e, '[data-place]');
      const place = choice && places[Number(choice.dataset.place)];
      if (place) picker?.show(place);
    }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && closest(e, '#wx-q')) {
      e.preventDefault();
      void search();
    }
  });
  // Escape closes the dialog natively; closing sends nothing, drops the map and returns focus to the button
  dialog.addEventListener('close', () => {
    picker?.remove();
    picker = null;
    el('#wx-fetch').focus();
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

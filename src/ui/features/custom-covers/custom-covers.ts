// "Moje opatulenia", a folded card after "Moje prace": the user's own covers, and the form that adds or edits one.
import { COVER_PRESETS, type CoverPresetId } from '../../../domain/covers';
import type { Formatter, Messages } from '../../../i18n';
import type { StoredCover } from '../../../storage/covers';
import type { AppContext } from '../../context';
import { byId, closest, esc } from '../../dom';
import { NUMBER_PATTERN, parseNumber } from '../../form';
import { CUSTOM_COVER_ICONS, coverIcon, icon, isCustomCoverIcon } from '../../icons';
import { scrollBehavior, toggleHeight } from '../../motion';
import type { CatalogCover } from '../../render';

/** Keeps the comparison bars readable and the two-phase search (pairs of covers) fast. */
export const MAX_CUSTOM_COVERS = 12;
export const MAX_NAME_LENGTH = 40;

type PresetChoice = CoverPresetId | 'custom';
const PRESET_CHOICES: readonly PresetChoice[] = [...COVER_PRESETS, 'custom'];
const isPreset = (s: string): s is CoverPresetId =>
  (COVER_PRESETS as readonly string[]).includes(s);

/** The catalog entry of a stored cover; an unknown icon gets the neutral one. */
export const toCatalogCover = (s: StoredCover): CatalogCover => ({
  id: s.id,
  factor: s.factor,
  airflow: s.airflow,
  environment: 'room',
  name: s.name,
  icon: isCustomCoverIcon(s.icon) ? s.icon : undefined,
});

export type NameProblem = 'empty' | 'tooLong' | 'taken';

/** Checks a typed name against the names already in use (compared trimmed, ignoring case). */
export function checkCoverName(name: string, taken: readonly string[]): NameProblem | null {
  const n = name.trim();
  if (!n) return 'empty';
  if (n.length > MAX_NAME_LENGTH) return 'tooLong';
  const key = n.toLowerCase();
  return taken.some((t) => t.trim().toLowerCase() === key) ? 'taken' : null;
}

/** A typed percentage from 1 to 100 (decimal comma accepted) as a factor; null when not one. */
export function parsePercent(raw: string): number | null {
  const s = raw.trim();
  if (!NUMBER_PATTERN.test(s)) return null;
  const v = parseNumber(s, NaN);
  return v >= 1 && v <= 100 ? v / 100 : null;
}

/** A factor as a percentage, with one decimal only when needed (0.155 → "15,5"). */
export function percentText(fmt: Formatter, factor: number): string {
  const pct = Math.round(factor * 1000) / 10;
  return fmt.decimal(pct, Number.isInteger(pct) ? 0 : 1);
}

/** An id no other cover has: `custom:` and the time in base 36, with a suffix if that is taken. */
export function newCoverId(nowMs: number, existing: readonly StoredCover[]): StoredCover['id'] {
  const base = `custom:${nowMs.toString(36)}`;
  let id = base;
  for (let i = 2; existing.some((c) => c.id === id); i++) id = `${base}-${i}`;
  return id as StoredCover['id'];
}

export function markup(m: Messages): string {
  const t = m.covers.custom;
  const icons = CUSTOM_COVER_ICONS.map(
    (name, i) =>
      `<label class="cc-icon" title="${t.icons[name]}"><input type="radio" name="cc-icon" value="${name}"${i === 0 ? ' checked' : ''}><span class="face">${icon(name)}<span class="vh">${t.icons[name]}</span></span></label>`,
  ).join('');
  return `<section class="card cc">
      <h2 class="cc-head"><button type="button" class="cc-toggle" id="cc-toggle" aria-expanded="false" aria-controls="cc-body">${icon('cover')}${t.title}</button></h2>
      <div class="hide" id="cc-body">
      <p class="muted">${t.intro}</p>
      <div id="cc-list"></div>
      <p class="muted hide" id="cc-limit">${t.limit(MAX_CUSTOM_COVERS)}</p>
      <button type="button" class="ghost" id="cc-add">${icon('plus')}${t.add}</button>
      <form class="cc-form hide" id="cc-form" novalidate aria-labelledby="cc-form-title">
        <h3 id="cc-form-title"></h3>
        <div class="grid">
          <div class="full"><label for="cc-name">${t.name}</label><input type="text" id="cc-name" autocomplete="off" placeholder="${t.namePlaceholder}"><p class="field-msg hide" id="cc-name-msg"></p></div>
          <fieldset class="full cc-icons"><legend>${t.icon}</legend><div class="opts">${icons}</div></fieldset>
          <div class="full"><label for="cc-preset">${t.speed}</label><select id="cc-preset">${PRESET_CHOICES.map((p) => `<option value="${p}">${t.presets[p]}</option>`).join('')}</select></div>
          <div class="cc-own hide"><label for="cc-pct">${t.percent}</label><div class="unit"><input type="text" inputmode="decimal" id="cc-pct"><span>${m.units.percent}</span></div><p class="field-msg hide" id="cc-pct-msg"></p></div>
          <div class="cc-own hide"><label class="check"><input type="checkbox" id="cc-air"> ${t.airflow}</label></div>
        </div>
        <p class="muted">${t.presetNote}</p>
        <div class="cc-actions"><button type="submit" class="main">${t.save}</button><button type="button" class="ghost" id="cc-cancel">${t.cancel}</button></div>
      </form>
      </div>
    </section>`;
}

/** The button beside the cover filter in "Termin" that opens the card; `render` writes its count. */
export const jumpMarkup = `<button type="button" class="ghost cc-jump" id="cc-jump" aria-controls="cc-body"></button>`;

/** Re-renders the list of the user's covers and the limit state of the add button. */
export function render(ctx: AppContext): void {
  const { m, fmt } = ctx.view;
  const t = m.covers.custom;
  const covers = ctx.customCovers;
  byId('cc-list').innerHTML = covers.length
    ? `<ul class="cc-list">${covers
        .map(
          (c) =>
            `<li>${coverIcon(toCatalogCover(c), 'cover-ico')}<span class="cc-name">${esc(c.name)}</span><span class="muted">${t.speedSummary(percentText(fmt, c.factor))}</span><span class="cc-acts"><button type="button" class="ghost" data-cc-edit="${c.id}" aria-label="${esc(t.editLabel(c.name))}">${t.edit}</button><button type="button" class="ghost" data-cc-del="${c.id}" aria-label="${esc(t.removeLabel(c.name))}">${t.remove}</button></span></li>`,
        )
        .join('')}</ul>`
    : `<p class="muted">${t.empty}</p>`;
  const full = covers.length >= MAX_CUSTOM_COVERS;
  const add = byId<HTMLButtonElement>('cc-add');
  add.disabled = full;
  if (full) add.setAttribute('aria-describedby', 'cc-limit');
  else add.removeAttribute('aria-describedby');
  byId('cc-limit').classList.toggle('hide', !full);
  byId('cc-jump').textContent = t.jump(covers.length);
}

/** Shows or clears the inline message of a form field, tied to it with `aria-describedby`. */
function showError(input: HTMLInputElement, msg: HTMLElement, text: string | null): void {
  msg.classList.toggle('hide', text === null);
  msg.textContent = text ?? '';
  if (text === null) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  } else {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', msg.id);
  }
}

export function mount(root: HTMLElement, ctx: AppContext): void {
  const form = byId<HTMLFormElement>('cc-form');
  const name = byId<HTMLInputElement>('cc-name');
  const preset = byId<HTMLSelectElement>('cc-preset');
  const pct = byId<HTMLInputElement>('cc-pct');
  const air = byId<HTMLInputElement>('cc-air');
  const add = byId<HTMLButtonElement>('cc-add');
  /** the cover being edited; null while adding one */
  let editing: StoredCover | null = null;

  const syncOwn = (): void => {
    root.querySelectorAll('.cc-own').forEach((e) => {
      e.classList.toggle('hide', preset.value !== 'custom');
    });
  };

  function open(c: StoredCover | null): void {
    const { m, fmt, params } = ctx.view;
    editing = c;
    byId('cc-form-title').textContent = c
      ? m.covers.custom.formEdit(c.name)
      : m.covers.custom.formNew;
    const start = params.coverPresets[COVER_PRESETS[0]!];
    name.value = c?.name ?? '';
    preset.value = c ? (isPreset(c.preset) ? c.preset : 'custom') : COVER_PRESETS[0]!;
    pct.value = percentText(fmt, c?.factor ?? start.factor);
    air.checked = (c?.airflow ?? start.airflow) === 'damped';
    const chosen = c && isCustomCoverIcon(c.icon) ? c.icon : CUSTOM_COVER_ICONS[0];
    form.querySelectorAll<HTMLInputElement>('input[name="cc-icon"]').forEach((r) => {
      r.checked = r.value === chosen;
    });
    showError(name, byId('cc-name-msg'), null);
    showError(pct, byId('cc-pct-msg'), null);
    syncOwn();
    form.classList.remove('hide');
    add.classList.add('hide');
    name.focus();
  }

  function close(focus: HTMLElement | null): void {
    editing = null;
    form.classList.add('hide');
    add.classList.remove('hide');
    (focus ?? add).focus();
  }

  const editButton = (id: string): HTMLElement | null =>
    root.querySelector<HTMLElement>(`[data-cc-edit="${CSS.escape(id)}"]`);

  function save(): void {
    const { m, params } = ctx.view;
    const t = m.covers.custom;
    const others = ctx.customCovers.filter((c) => c.id !== editing?.id);
    const problem = checkCoverName(name.value, [
      ...Object.values(m.covers.label),
      ...others.map((c) => c.name),
    ]);
    const choice = preset.value as PresetChoice;
    const factor =
      choice === 'custom' ? parsePercent(pct.value) : params.coverPresets[choice].factor;
    const nameText = {
      empty: t.nameEmpty,
      tooLong: t.nameTooLong(MAX_NAME_LENGTH),
      taken: t.nameTaken,
    };
    showError(name, byId('cc-name-msg'), problem && nameText[problem]);
    showError(pct, byId('cc-pct-msg'), factor === null ? t.percentRange : null);
    if (problem || factor === null) {
      (problem ? name : pct).focus();
      return;
    }
    const now = ctx.now();
    const cover: StoredCover = {
      id: editing?.id ?? newCoverId(now, ctx.customCovers),
      name: name.value.trim(),
      factor,
      airflow:
        choice === 'custom'
          ? air.checked
            ? 'damped'
            : 'none'
          : params.coverPresets[choice].airflow,
      preset: choice,
      icon:
        form.querySelector<HTMLInputElement>('input[name="cc-icon"]:checked')?.value ??
        CUSTOM_COVER_ICONS[0],
      created: editing?.created ?? now,
    };
    const was = editing;
    ctx.storeCovers(
      was
        ? ctx.customCovers.map((c) => (c.id === was.id ? cover : c))
        : [...ctx.customCovers, cover],
    );
    render(ctx);
    close(editButton(cover.id));
  }

  function remove(id: string): void {
    const c = ctx.customCovers.find((x) => x.id === id);
    if (!c) return;
    const used = ctx.pieces.filter(
      (p) => p.dom === id || (Array.isArray(p.plan) && p.plan.some((s) => s?.w === id)),
    ).length;
    if (used && !window.confirm(ctx.view.m.covers.custom.confirmRemove(c.name, used))) return;
    if (editing?.id === id) close(null);
    ctx.storeCovers(ctx.customCovers.filter((x) => x.id !== id));
    render(ctx);
    add.focus();
  }

  const toggle = byId('cc-toggle');
  const card = toggle.closest<HTMLElement>('section')!;
  const expand = (on: boolean): void => {
    toggle.setAttribute('aria-expanded', String(on));
    toggleHeight(byId('cc-body'), on);
  };

  render(ctx);
  preset.addEventListener('change', syncOwn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  // from "Termin": open the card and move there, focus on its toggle
  byId('cc-jump').addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') !== 'true') expand(true);
    card.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    toggle.focus({ preventScroll: true });
  });
  card.addEventListener('click', (e) => {
    const b = closest(e, '#cc-toggle, #cc-add, #cc-cancel, [data-cc-edit], [data-cc-del]');
    if (!b) return;
    if (b.id === 'cc-toggle') expand(b.getAttribute('aria-expanded') !== 'true');
    else if (b.id === 'cc-add') open(null);
    else if (b.id === 'cc-cancel') close(editing ? editButton(editing.id) : null);
    else if (b.dataset.ccEdit)
      open(ctx.customCovers.find((c) => c.id === b.dataset.ccEdit) ?? null);
    else remove(b.dataset.ccDel ?? '');
  });
}

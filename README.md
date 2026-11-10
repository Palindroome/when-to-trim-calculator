# Kiedy trymować? (When to trim?)

A calculator for potters. It estimates when a freshly thrown piece reaches leather-hard and is ready to trim. It also suggests how to cover the piece (open, loosely bagged, damp room, fully bagged, box) so that it hits the date you want. Each saved piece you rate ("too wet / just right / too dry") calibrates the model to your studio. The data stays in your browser's localStorage.

Built with Vite and strict TypeScript, with no framework. The original single-file prototype is in git history, in the `reference` folder at commit `f4ac746`.

## Commands

```bash
npm ci                    # install
npm run dev               # dev server with hot reload
npm run build             # typecheck + production build into dist/
npm run preview           # serve dist/
npm run typecheck         # tsc, strict
npm test                  # unit tests (Vitest), pure logic only
npm run test:e2e          # Playwright e2e against the production build
```

The first Playwright run needs a browser: `npx playwright install chromium`. On Linux it also needs the system libraries: `sudo npx playwright install-deps chromium`.

The build uses `base: './'`, so `dist/` works from any sub-path, for example GitHub Pages at `/when-to-trim-calculator/`. The Pages workflow runs `npm ci && npm run build` and deploys `dist/`.

### Visual regression check (optional)

Screenshots are compared with an earlier run of the build.

```bash
VISUAL=1 npx playwright test e2e/visual.spec.ts --update-snapshots  # baseline from the build, before a change
VISUAL=1 npx playwright test e2e/visual.spec.ts                     # compare after the change (VISUAL_STRICT=1: pixel-exact)
```

Each state is captured in the light and the dark colour scheme (`light-…png`, `dark-…png`). Baselines go to `e2e/__screenshots__/`. That folder is git-ignored because the images depend on the machine.

## Structure

```
index.html            page skeleton (colour-scheme metas, inline script applying a stored theme before first paint, font preload, <main>); everything else is rendered by src/
public/fonts/         self-hosted Inter variable font (Latin subset) and its OFL licence
src/
  main.ts             composition root: picks language, params, storage, conditions source, models
  style.css           design tokens (one :root block: type, space, radii, colour roles, shadows; dark values as --d-*) + components
  domain/             pure logic, no DOM; unit-tested
    types.ts          ids (Cover, ShapeId, ...), Piece, Conditions, Plan
    params.ts         ModelParams + DEFAULT_PARAMS: every model constant in one typed object
    piece.ts          derivePiece: area, slowness, target loss / trimming window
    physics.ts        psat, RateModel interface, physicalRateModel
    simulate.ts       time-stepping simulation of a covering plan
    planner.ts        planDrying: single / two-phase plans, warnings, alternatives
    calibration.ts    Calibrator interface, geometricMeanCalibrator, feedbackToSample
    weight.ts         weight check (loss vs. window, time remaining)
    tips.ts           which practical tips apply
    conditions.ts     ConditionsSource interface
  i18n/
    pl.ts             Polish catalog: the source of truth; exports the `Messages` type
    en.ts             English catalog
    format.ts         locale-aware formatter (durations, dates, decimals)
    index.ts          locale registry, getMessages(), resolveLocale() (initial language)
  storage/
    pieces.ts         StoredPiece (v1 format), PieceRepository, LocalStoragePieceRepository
    preferences.ts    chosen UI language (`kiedy-trymowac-lang`) and theme (`kiedy-trymowac-theme`)
    wizard.ts         WizardStore: whether the first-run wizard was finished or skipped (own key, `kiedy-trymowac-wizard`)
  ui/
    shell.ts          static page markup from the catalog
    form.ts           reads inputs; formConditionsSource
    render.ts         HTML for result, pieces, calibration, weight check
    app.ts            state + event wiring
    wizard.ts         first-run wizard: shows the [data-step] sections (1-3) one at a time, then the whole page
    cards.ts          after the wizard, sections 1-3 collapse to one-line summaries that open on click
e2e/                  Playwright suite (runs against the production build)
scripts/agent/        helper scripts for the agent workflow (issue, worktree, checks, viewport, hygiene, labels); see CLAUDE.md
```

Dependencies point one way: `ui → domain, i18n, storage`. `domain` never imports UI, DOM, i18n or storage code.

## Extension points

- **New language.**
  1. Copy `src/i18n/en.ts` to e.g. `de.ts` and translate it.
  2. Type it as `const de: Messages = {...}`. The compiler then reports any missing key.
  3. Register it in `LOCALES` in `src/i18n/index.ts`, and add its endonym to `language.names` in every catalog.

  The `PL | EN` switch in the page header gets one button per registered locale (turn it into a select once there are more than about three). Switching re-renders the page without a reload and keeps the form, the saved pieces and the calibration. The choice is stored under its own localStorage key, `kiedy-trymowac-lang`; `kiedy-trymowac-v1` is not touched.

  The initial language comes from `resolveLocale()`, called in `main.ts`: a stored choice, then Polish when saved pieces already exist, then the first browser language (`navigator.languages`, primary subtag) that is registered, otherwise `DEFAULT_LOCALE` (Polish). Only a click on the switch stores a choice.

  Weekday and month names, decimal separator, duration wording and the date-time pattern live in the `format` section of the catalog.

  Saved pieces store their plan sentence (`label`) in the language that was active at save time. The piece list re-renders it from `plan` in the current language and falls back to `label` for unexpected plan shapes.
- **Colour schemes.** Components use only the colour-role tokens in `src/style.css`. Dark mode overrides those same tokens with the `--d-*` values, either when the system prefers dark (`prefers-color-scheme`) or when `data-theme="dark"` is set on `<html>`; `data-theme="light"` forces the light values. The `System | Light | Dark` switch next to the language switch sets that attribute and stores `light` / `dark` under `kiedy-trymowac-theme` (System removes the key). A new component that uses the tokens works in both schemes without extra CSS; a new colour role needs a light value and a `--d-*` value assigned in both dark blocks.
- **Fitted parameters.** Every coefficient is in `ModelParams` (`src/domain/params.ts`): evaporation coefficient, cover factors, shape/clay/surface factors, wetness/stage offsets, window bounds, planner and tip thresholds. Pass a different object to `startApp`.
- **Trained models.** There are two seams:
  - `RateModel` (`domain/physics.ts`) predicts grams per hour for a cover, time, piece and conditions. Replace `physicalRateModel` to change the drying physics itself.
  - `Calibrator` / `CalibratorFactory` (`domain/calibration.ts`) turns feedback samples into per-cover time multipliers (`estimate`, `multipliers`, `learn`). Replace `geometricMeanCalibrator` to plug in a learned correction.
- **Training data.** Each rated piece already stores start time, mass, target loss, the plan, predicted vs. actual hours, the calibration used and the feedback. It does not store the piece inputs (shape, walls, clay, ...) or the conditions. Adding them would change the stored format, so it was deliberately left out. To collect them:
  1. Add optional fields, e.g. `input` and `conditions`, to `StoredPiece`. Older readers ignore unknown fields, and older records simply lack them.
  2. Fill them in `savePiece` (`ui/app.ts`).
  3. Keep the key `kiedy-trymowac-v1`, or introduce a v2 repository that migrates from v1.
- **Sensors.** Implement `ConditionsSource` (`domain/conditions.ts`): `read()` returns `Conditions`, and the optional `subscribe(onChange)` triggers a recalculation. `formConditionsSource` in `ui/form.ts` is the current implementation. A sensor source can wrap it and override, for example, `temp` and `rh`.
- **Storage.** `PieceRepository` hides localStorage. The localStorage implementation keeps the prototype's v1 format byte-for-byte, so existing data keeps working.

# Kiedy trymować? (When to trim?)

A calculator for potters. It estimates when a freshly thrown piece reaches leather-hard and is ready to trim. It also suggests how to cover the piece (open, loosely bagged, damp room, fully bagged, box) so that it hits the date you want. Each saved piece you rate ("too wet / just right / too dry") calibrates the model to your studio. The data stays in your browser's localStorage.

Built with Vite and strict TypeScript, with no framework. The original single-file prototype is kept in `reference/index.html`. It is the behavioural reference for the e2e suite.

## Commands

```bash
npm ci                    # install
npm run dev               # dev server with hot reload
npm run build             # typecheck + production build into dist/
npm run preview           # serve dist/
npm run typecheck         # tsc, strict
npm test                  # unit tests (Vitest), pure logic only
npm run test:e2e          # Playwright e2e against the production build
npm run test:e2e:prototype  # the same e2e suite against reference/index.html
```

The first Playwright run needs a browser: `npx playwright install chromium`. On Linux it also needs the system libraries: `sudo npx playwright install-deps chromium`.

The build uses `base: './'`, so `dist/` works from any sub-path, for example GitHub Pages at `/when-to-trim-calculator/`. The Pages workflow runs `npm ci && npm run build` and deploys `dist/`.

### Visual parity check (optional)

```bash
VISUAL=1 E2E_TARGET=prototype npx playwright test e2e/visual.spec.ts --update-snapshots  # baseline from the prototype
VISUAL=1 npx playwright test e2e/visual.spec.ts                                          # compare the build (VISUAL_STRICT=1: pixel-exact)
```

Baselines go to `e2e/__screenshots__/`. That folder is git-ignored because the images depend on the machine.

## Structure

```
index.html            page skeleton (fonts, <main>); everything else is rendered by src/
src/
  main.ts             composition root: picks language, params, storage, conditions source, models
  style.css
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
    format.ts         locale-aware formatter (durations, dates, decimals)
    index.ts          locale registry, getMessages()
  storage/
    pieces.ts         StoredPiece (v1 format), PieceRepository, LocalStoragePieceRepository
  ui/
    shell.ts          static page markup from the catalog
    form.ts           reads inputs; formConditionsSource
    render.ts         HTML for result, pieces, calibration, weight check
    app.ts            state + event wiring
e2e/                  Playwright suite (runs unchanged against the prototype and the build)
reference/index.html  original prototype
```

Dependencies point one way: `ui → domain, i18n, storage`. `domain` never imports UI, DOM, i18n or storage code.

## Extension points

- **New language.**
  1. Copy `src/i18n/pl.ts` to e.g. `en.ts` and translate it.
  2. Type it as `const en: Messages = {...}`. The compiler then reports any missing key.
  3. Register it in `LOCALES` in `src/i18n/index.ts`.
  4. Pass `getMessages('en')` in `main.ts`, or add a language switch.

  Weekday names, decimal separator and duration wording live in the `format` section of the catalog.

  Saved pieces store their plan sentence (`label`) in the language that was active at save time. Re-render it from `plan` if that should follow the current language.
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

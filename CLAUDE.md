# Project notes for agents

"Kiedy trymować?" is a Polish calculator for potters. It estimates when a thrown piece is ready to trim and how to cover it. Live at https://palindroome.github.io/when-to-trim-calculator/ (GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`). Read `README.md` for the structure and extension points.

## Environment

- The repo lives in WSL Ubuntu at `~/when-to-trim-calculator`. If your shell is Windows PowerShell, run Linux commands as `wsl -e bash -lc '<cmd>'`. PowerShell 5.1 mangles embedded double quotes and `|`, so for anything non-trivial write a `.sh` script and run `wsl -e bash -l /mnt/c/.../script.sh`.
- Node comes from nvm and is not on PATH in non-interactive shells: start commands with `. ~/.nvm/nvm.sh;`.
- `gh` is installed and logged in (account Palindroome) in WSL.

## Commands

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:e2e              # builds, then runs Playwright against the build
npm run test:e2e:prototype    # same suite against reference/index.html
npm run build
```

## Rules

- **Git identity:** commit with the configured git identity only. Never set author or committer by env vars or flags.
- **No AI attribution:** never add `Co-Authored-By` trailers or mention Claude, Anthropic or AI assistance in commits, PRs, issues, code, comments or docs.
- **No direct work on `main`:** never commit to `main`, merge into it, push it, or force-push anything unless the user explicitly asks in this conversation. Work on feature branches.
- **Architecture:**
  - `src/domain` is pure: no DOM, i18n or storage imports.
  - All user-facing text goes through `src/i18n` (`pl.ts` is the source of truth).
  - All model constants live in `ModelParams` (`src/domain/params.ts`).
  - Keep the `kiedy-trymowac-v1` localStorage format backward compatible.
- **Planned features:** more languages, ML-fitted drying parameters per studio, and temperature/humidity sensors.
  - Keep them easy to add by using the existing seams and layer boundaries.
  - Don't build speculative abstractions for them before an issue asks for one (see the coding principles in `.claude/agents/implementer.md`).
- **Behaviour changes:** a change in behaviour must be intentional and covered by tests. When outputs change, re-record `e2e/golden.json` (see `e2e/record.spec.ts`) and confirm that only the intended scenarios changed.
- **Language:** write issues, PRs, commits and code in English. UI text stays Polish in `pl.ts`.

## GitHub labels

Every issue gets exactly one type label and one or more area labels. This table is the approved label set.
- A label from the table that is missing on GitHub may be created with the colour below (`gh label create <name> --color <hex> --description "<text>"`).
- A label that is not in the table needs the user's approval first: propose it to the orchestrator or user, and add it here once approved.

| Label | Kind | Colour | Use for |
|---|---|---|---|
| `bug` | type | d73a4a | something behaves incorrectly |
| `enhancement` | type | a2eeef | a new feature or an improvement |
| `documentation` | type | 0075ca | docs only |
| `area:ui` | area | 1d76db | layout, CSS, DOM, interaction (`src/ui`, `style.css`) |
| `area:model` | area | 5319e7 | drying physics, planner, calibration, params (`src/domain`) |
| `area:i18n` | area | fbca04 | translations, formatting, new languages (`src/i18n`) |
| `area:storage` | area | c5def5 | localStorage format, repositories, migrations |
| `area:ml` | area | 8a2be2 | learned or fitted parameters, training data |
| `area:sensors` | area | 0e8a16 | temperature/humidity devices, `ConditionsSource` |
| `area:tests` | area | bfdadc | e2e/unit tests, golden data |
| `area:ci` | area | ededed | GitHub Actions, Pages deployment, tooling |
| `status:in-progress` | status | fef2c0 | an implementer is assigned and working |
| `status:needs-validation` | status | f9d0c4 | implemented on a branch, waiting for the validator |
| `status:changes-requested` | status | e99695 | the validator rejected it, back to the implementer |
| `status:validated` | status | 0e8a16 | the validator approved it, ready for the user to merge |

Optional extra labels: `accessibility`, `good first issue`. An issue has at most one `status:*` label at a time.

## Agent workflow

Three project agents live in `.claude/agents/`: `issue-writer`, `implementer` and `validator`. How they hand work to each other is described in `docs/agent-workflow.md`.

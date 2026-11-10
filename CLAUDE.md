# Project notes for agents

"Kiedy trymować?" is a Polish calculator for potters. It estimates when a thrown piece is ready to trim and how to cover it. Live at https://palindroome.github.io/when-to-trim-calculator/ (GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`). Read `README.md` for the structure and extension points.

## Environment

- The repo lives in WSL Ubuntu at `~/when-to-trim-calculator`. If your shell is Windows PowerShell, run Linux commands as `wsl -e bash -lc '<cmd>'`. Windows tools see the files at `\\wsl.localhost\ubuntu-22.04\home\antek\…`.
- Node comes from nvm and is not on PATH in non-interactive shells: start commands with `. ~/.nvm/nvm.sh;` (the agent scripts do this themselves).
- `gh` is installed and logged in (account Palindroome) in WSL.

## Tooling rules for agents

Past runs lost most of their turns to the same few problems. Follow these rules:

- **Use the agent scripts** (next section) instead of writing your own setup, check, label or probe commands.
- **No inline shell with special characters from PowerShell.** PowerShell 5.1 mangles `"`, `|`, `(`, `$(`, `<`, `>` and commas inside `wsl -e bash -lc '…'` (for example `--jq ".a, .b"`, `grep "a\|b"`, `python3 -c "…"`). Anything beyond plain words goes in a `.sh` file in your scratchpad, run with `wsl -e bash -l /mnt/c/…/x.sh`.
- **Open a file with Read before you Edit or Write it.** Use the `\\wsl.localhost\ubuntu-22.04\home\antek\…` path. Viewing it with `cat`/`sed` in WSL does not count, and the edit is rejected.
- **Run scripts with `bash <script>`.** Editing a file through the `\\wsl.localhost` path drops its exec bit.
- **Read the issue once.** Plain `gh issue view N` prints nothing in this setup. Use `scripts/agent/issue.sh N` and re-read `/tmp/wtc-issue-N.md` later.
- **The `status:*` labels exist on GitHub.** Do not try to create them.
- **Subagents:** do not call `update_plan` or `wrap_up`. They are blocked.
- **Worktrees:** use `~/wtc-worktrees/<branch>` through `worktree.sh`. Never use the Agent tool's `isolation: "worktree"`, which fails on this WSL repo.
- **Keep tool output small.** Pipe through `tail`/`grep`, and never print whole files you can Read. A `grep` with no match exits 1, which is not an error.

## Agent scripts

Run them with `wsl -e bash -l <checkout>/scripts/agent/<script> <args>`. Arguments are plain words, so they need no quoting. The `<checkout>` is:
- `~/when-to-trim-calculator` for `issue.sh`, `search.sh`, `new-issue.sh`, `status.sh` and `worktree.sh`;
- your worktree for `check.sh`, `viewport.sh` and `hygiene.sh`, which act on the checkout they live in.

| Script | Does |
|---|---|
| `issue.sh N` | prints issue N with its comments, and saves it to `/tmp/wtc-issue-N.md` |
| `search.sh <words>` | lists open and closed issues matching the words (duplicate check) |
| `new-issue.sh <body.md> <label>…` | files an issue; the first line of the file is the title; checks that the labels exist |
| `status.sh N <in-progress\|needs-validation\|validated\|changes-requested> [--assign]` | sets the single `status:*` label (and claims the issue) |
| `worktree.sh <branch>` | reuses or creates `~/wtc-worktrees/<branch>` from `origin/main`, then runs `npm ci` |
| `worktree.sh --validate <branch>` / `--main` / `--remove <path>` | fresh detached worktree for validation or for reproducing on `origin/main`; removal |
| `check.sh [--prototype] [steps…]` | typecheck, unit, e2e (own free port), build; one line per step, plus the failure tail |
| `viewport.sh [--shots DIR] [--keep]` | builds and serves on a free port; checks 320/375/1280 px for overflow, a rendered `#result` and console errors; stops its server |
| `hygiene.sh <branch> [N]` | base on `origin/main`, identity, AI mentions, commit convention, `Fixes #N`, stray files, `src/domain` purity |

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
- **Changes reach `main` only through a pull request that the user merges.** Work on feature branches.
  - Never commit to `main`, merge into it, push it or force-push anything. This holds even when you are asked to "merge", "push" or "ship".
  - To publish work, push the feature branch and open a PR against `main` (`gh pr create -R Palindroome/when-to-trim-calculator --base main --head <branch> --title … --body-file <file>`). Then report the PR link.
  - Push the branch and open the PR only when the user asks for it. Until then, commits stay local.
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

## Commit message convention

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope:

```
<type>(<scope>): <subject>

<body: why the change was needed and what it does, wrapped at ~72 chars>

<footer: Fixes #N / Refs #N / BREAKING CHANGE: …>
```

- **type:** one of
  - `feat`: new user-facing behaviour;
  - `fix`: a bug fix;
  - `test`: tests only;
  - `refactor`: no behaviour change;
  - `perf`: faster, same behaviour;
  - `style`: formatting only, not CSS changes (those are `fix`/`feat` in `ui`);
  - `docs`: documentation;
  - `build`: dependencies, Vite or TypeScript config;
  - `ci`: GitHub Actions or Pages;
  - `chore`: tooling, agents, repo housekeeping.
- **scope:** the part of the project the change touches, matching the `area:*` labels:
  - `ui`, `model`, `i18n`, `storage`, `ml`, `sensors`, `tests` (or more precisely `e2e`/`unit`), `ci`;
  - also `docs`, `deps` and `agents` (`.claude/`, `CLAUDE.md`, `docs/agent-workflow.md`);
  - when a commit really spans two areas, use the main one. Several unrelated areas means the commit should be split.
- **subject:**
  - imperative and lowercase, with no trailing period;
  - at most 72 characters including the prefix;
  - says what changes for a reader of the log, e.g. `fix(ui): stop date-time inputs overflowing on phones`, not `fix(ui): update style.css`.
- **body:**
  - required unless the subject says it all;
  - explains the reason and the approach, and mentions behaviour or golden-data changes.
- **footer:**
  - `Fixes #N` on the commit that completes an issue;
  - `Refs #N` for partial work;
  - `BREAKING CHANGE: …`, plus `!` after the scope, when the stored data format or a public interface changes incompatibly.
- On Windows PowerShell, write the message to a file and use `git commit -F <file>` (`-F /mnt/c/…` from WSL).

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
| `status:needs-validation` | status | f9d0c4 | a validation round is running |
| `status:changes-requested` | status | e99695 | still rejected after 3 validation rounds, waiting for the user |
| `status:validated` | status | 0e8a16 | the validator approved it, ready for the user to merge |

Optional extra labels: `accessibility`, `good first issue`. An issue has at most one `status:*` label at a time. Only the implementer sets `status:*` labels; the validator never touches labels.

## Agent workflow

Three project agents live in `.claude/agents/`: `issue-writer`, `implementer` and `validator`. How they hand work to each other is described in `docs/agent-workflow.md`.

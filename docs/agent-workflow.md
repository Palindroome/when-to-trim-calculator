# Agent workflow

How work moves from an idea to a validated branch. Three project agents take part (`.claude/agents/`), and the user makes every decision about merging and releasing.

```
 idea / bug report
        │
        ▼
 ┌──────────────┐  issue #N, labels: type + area
 │ issue-writer │ ─────────────────────────────────────┐
 └──────────────┘                                      │
                                                       ▼
 ┌──────────────┐  assigns self, status:in-progress, branch fix/N-… or feat/N-…
 │ implementer  │  commits on that branch, runs all checks
 └──────────────┘
        │  round k = 1..3: status:needs-validation, spawns a fresh validator
        ▼
 ┌──────────────┐  re-runs checks in its own worktree, reviews the diff,
 │  validator   │  returns a report to the implementer (no labels, no comments)
 └──────────────┘
     │       │
     │       └─ changes requested → implementer fixes every finding, commits,
     │          next round (back to the arrow above)
     │
     ├─ approved (any round) → implementer sets status:validated
     │                         → hand-off report to orchestrator
     │                         → PR from the branch (when the user asks)
     │                         → user reviews and merges the PR
     │
     └─ still rejected after round 3 → implementer sets status:changes-requested
                                       → hand-off report + all reports to orchestrator
                                       → user decides
```

Validation reports and hand-off reports never go to the issue. They pass only between the implementer and the validator, and then to the orchestrator. During the loop, the only GitHub updates are `status:*` labels.

## 1. Writing an issue (`issue-writer`)

- Input: a bug report or feature idea from the user, in any language and any level of detail.
- The agent:
  - investigates the code;
  - reproduces bugs on the live site or a local build;
  - checks for duplicates (`gh issue list --search`).
- It then opens one issue per independent problem. Each issue uses the bug or feature template from the agent's instructions and is labelled with exactly one type label (`bug`, `enhancement`, `documentation`) plus one or more `area:*` labels.
- No status label at this stage.
- Labels: only labels from the approved table in `CLAUDE.md` are used.
  - If an issue needs a label that is not in the table, the issue-writer does not create it.
  - It returns to the orchestrator with a label proposal (name, colour, description, rationale) and the drafted issue.
  - The orchestrator asks the user. Once the label is approved and added to `CLAUDE.md`, the issue is filed.
- Output: issue URL(s) and a one-paragraph summary, plus any label proposals awaiting a decision.

## 2. Implementing (`implementer`)

- **Task linked to an issue** (`#N`, an issue URL, or a task matching an open issue):
  - `gh issue edit N --add-assignee @me`;
  - swap any `status:*` label for `status:in-progress`;
  - branch `fix/N-short-slug` for bugs, `feat/N-short-slug` for enhancements, `docs/N-…` for docs.
- **Task without an issue:** no GitHub changes. Branch `fix/…`, `feat/…` or `chore/…` from a short slug.
- **Branch base:**
  - A new branch always starts from an up-to-date `origin/main`.
  - It lives in its own worktree under `~/wtc-worktrees/<branch-name>`, so the main checkout and other agents are never disturbed.
  - Between validation rounds, and when the user restarts work after `status:changes-requested`, it reuses the existing branch and worktree.
- **Changes:**
  - Commits are small and focused, written in the imperative mood, and may reference the issue (`Fixes #N` in the final commit body).
  - The configured git identity is used, with no AI attribution (see `CLAUDE.md`).
- **Before handing off:** `npm run typecheck`, `npm run test:unit`, `npm run test:e2e` and `npm run build` must all pass. New behaviour has tests, and golden data is re-recorded only for scenarios that are meant to change.
- **Validation loop (up to 3 rounds):** the implementer owns the loop and its status labels. It posts no issue comments in the loop.
  1. It sets `status:needs-validation` and spawns a **fresh** validator with the branch, the issue, the round number and, from round 2 on, the previous report.
  2. If the report says changes are requested, it sets `status:in-progress`, fixes every finding, re-runs all checks, commits, and starts the next round.
  3. If the report says approved, it sets `status:validated` and returns the hand-off report to the orchestrator.
  4. If round 3 is still rejected, it sets `status:changes-requested` and returns the hand-off report, all validation reports and the open findings to the orchestrator, which asks the user how to proceed.
  5. When the user restarts work after `status:changes-requested`, the orchestrator passes the open findings to the implementer, since they are not on the issue.
- **Spawning limits:** Claude Code subagents usually cannot spawn agents. An implementer running as a subagent returns `READY FOR VALIDATION` instead. The orchestrator then spawns the validator and resumes the same implementer with the report. The loop and the 3-round limit are unchanged.
- **Hand-off report** (to the orchestrator only): the branch and commits, the verdict and rounds used, assumptions, what changed, the tests and check results, golden changes, and open items.
- **Never** commit to, merge into or push `main`.
  - The implementer pushes its feature branch and opens a PR only when the user asks for that in the conversation.
  - Merging is always the user's job, on GitHub.

## 3. Validating (`validator`)

- Input: a branch name and/or an issue number, the round number, and from round 2 on the previous report.
- The agent works in its own worktree (`~/wtc-worktrees/validate-<branch>`) and does not edit files or commit.
- It checks:
  1. **Requirements:** every acceptance criterion in the issue is met (or the task description, when there is no issue).
  2. **Checks:** a clean `npm ci`, then `typecheck`, `test:unit`, `test:e2e` and `build`, all re-run by the validator itself. It does not trust the implementer's report.
  3. **Behaviour:**
     - bugs are reproduced on `main` and confirmed fixed on the branch;
     - UI changes are checked at 320/375/1280 px;
     - nothing outside the scope changed (golden diff limited to the intended scenarios).
  4. **Architecture rules** from `CLAUDE.md`: a pure domain, all strings in i18n, params in `ModelParams`, the storage format compatible.
  5. **Hygiene:**
     - author and committer match the configured identity;
     - no `Co-Authored-By` or AI mentions in commits or files;
     - no stray files, no debug code;
     - the branch is based on current `origin/main`.
- **Verdict:** a report returned to its caller, normally the implementer. The validator makes **no GitHub writes**: no labels, comments or assignments.
  - The report has: approved or changes requested, a table of acceptance criteria → result → evidence, check results, and findings (severity, `file:line`, evidence, fix).
  - From round 2 on, it also says which earlier findings are fixed and which are still open.

## 4. Merge and release (user)

- When the user asks, an agent pushes the validated feature branch and opens a PR against `main`.
- The user reviews and merges the PR on GitHub. No agent ever merges into or pushes `main`, even when asked to; it opens a PR instead.
- A merge to `main` deploys to GitHub Pages automatically.
- Remove worktrees for merged branches: `git worktree remove ~/wtc-worktrees/<branch>`.

## Tooling

All three agents use the helper scripts in `scripts/agent/` (listed in `CLAUDE.md` under "Agent scripts"). The scripts cover:
- reading and searching issues;
- filing issues;
- setting status labels;
- creating worktrees;
- running the checks;
- the 320/375/1280 px viewport probe;
- branch hygiene.

They exist because inline shell commands from PowerShell into WSL break on quoting. Writing the same helpers again in every run cost most of the turns in early runs.

## Running the workflow

In Claude Code, ask for an agent by name, e.g. "use the issue-writer to file …", "use the implementer on #3", "use the validator on fix/3-…". The `/issue-flow <issue-number or task>` skill runs the whole thing end to end: implementer, then up to 3 validation rounds, then a report. It relays between implementer and validator when the implementer cannot spawn agents itself, and asks the user if work is still rejected after 3 rounds.

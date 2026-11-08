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
 └──────────────┘  status:needs-validation
        │
        ▼
 ┌──────────────┐  re-runs checks in its own worktree, reviews the diff
 │  validator   │  against the issue's acceptance criteria
 └──────────────┘
     │       │
     │       └─ rejected → status:changes-requested, findings in an issue comment
     │                     → back to the implementer on the same branch
     ▼
 status:validated → the user reviews, then merges and pushes (or asks an agent to)
```

## 1. Writing an issue (`issue-writer`)

- Input: a bug report or feature idea from the user, in any language and any level of detail.
- The agent:
  - investigates the code;
  - reproduces bugs on the live site or a local build;
  - checks for duplicates (`gh issue list --search`).
- It then opens one issue per independent problem. Each issue uses the bug or feature template from the agent's instructions and is labelled with exactly one type label (`bug`, `enhancement`, `documentation`) plus one or more `area:*` labels.
- No status label at this stage.
- Output: issue URL(s) and a one-paragraph summary.

## 2. Implementing (`implementer`)

- **Task linked to an issue** (`#N`, an issue URL, or a task matching an open issue):
  - `gh issue edit N --add-assignee @me`;
  - swap any `status:*` label for `status:in-progress`;
  - branch `fix/N-short-slug` for bugs, `feat/N-short-slug` for enhancements, `docs/N-…` for docs.
- **Task without an issue:** no GitHub changes. Branch `fix/…`, `feat/…` or `chore/…` from a short slug.
- **Branch base:**
  - A new branch always starts from an up-to-date `origin/main`.
  - It lives in its own worktree under `~/wtc-worktrees/<branch-name>`, so the main checkout and other agents are never disturbed.
  - When it continues after `status:changes-requested`, it reuses the existing branch and worktree.
- **Changes:**
  - Commits are small and focused, written in the imperative mood, and may reference the issue (`Fixes #N` in the final commit body).
  - The configured git identity is used, with no AI attribution (see `CLAUDE.md`).
- **Before handing off:** `npm run typecheck`, `npm run test:unit`, `npm run test:e2e` and `npm run build` must all pass. New behaviour has tests, and golden data is re-recorded only for scenarios that are meant to change.
- **When done (issue tasks):** `status:needs-validation`, plus an issue comment with the branch name, what changed, how it was tested and anything left open.
- **Never:** push, open PRs, merge or touch `main`, unless the user asked for that in the conversation.

## 3. Validating (`validator`)

- Input: a branch name and/or an issue number.
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
- **Verdict:**
  - **Approved:** `status:validated`, plus an issue comment with the evidence (commands and results).
  - **Rejected:** `status:changes-requested`, plus an issue comment listing each finding with file:line, why it fails and what would fix it.
  - With no issue, it only reports back.

## 4. Merge and release (user)

- The user reviews the validated branch, then merges and pushes it themselves or asks an agent to do so explicitly.
- A push to `main` deploys to GitHub Pages automatically.
- Remove worktrees for merged branches: `git worktree remove ~/wtc-worktrees/<branch>`.

## Running the workflow

In Claude Code, ask for an agent by name, e.g. "use the issue-writer to file …", "use the implementer on #3", "use the validator on fix/3-…". The `/issue-flow <issue-number or task>` skill runs implementer → validator end to end, looping at most twice on `changes-requested` before asking the user.

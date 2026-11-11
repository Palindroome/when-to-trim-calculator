#!/usr/bin/env bash
# Branch hygiene and architecture checks used before hand-off and by the validator.
#
#   hygiene.sh <branch> [issue-number]
#
# Checks: branch contains origin/main; author/committer match git config; no
# AI attribution in commits or the diff; commit messages follow the
# convention in CLAUDE.md; the last commit has `Fixes #N`; no stray files;
# src/domain stays pure. The issue number defaults to the one in the branch
# name (fix/12-... -> 12). Exit code is non-zero if a check failed.
. "$(dirname "$0")/lib.sh"

B="${1:-}"; [[ -n "$B" ]] || die "usage: hygiene.sh <branch> [issue]"
N="${2:-}"; [[ -z "$N" && "$B" =~ ^[a-z]+/([0-9]+)- ]] && N="${BASH_REMATCH[1]}"

cd "$ROOT" || exit 1
git fetch -q origin
git rev-parse -q --verify "$B" >/dev/null || B="origin/$B"
git rev-parse -q --verify "$B" >/dev/null || die "no branch $1"
range="origin/main..$B"
fail=0 mark=0
bad() { echo "FAIL: $*"; fail=$((fail + 1)); }
section() { mark=$fail; }          # start a group of checks
clean() { [[ $fail -eq $mark ]]; } # no failure since section()

echo "branch $B at $(git rev-parse --short "$B"), $(git rev-list --count "$range") commit(s) on top of origin/main"

git merge-base --is-ancestor origin/main "$B" && echo "ok: contains origin/main" || bad "branch does not contain current origin/main (rebase it)"

me="$(git config user.name) <$(git config user.email)>"
section
while IFS='|' read -r sha author committer; do
  [[ "$author" == "$me" && "$committer" == "$me" ]] || bad "$sha author '$author' committer '$committer', expected '$me'"
done < <(git log --format='%h|%an <%ae>|%cn <%ce>' "$range")
clean && echo "ok: identity $me"

ai_re='co-authored-by|anthropic|\bclaude\b|\bAI[ -](assist|generated)'
# The project paths CLAUDE.md and .claude/ contain the word and may be named in messages.
paths_re='\.claude/|CLAUDE\.md'
hits=$(git log --format=%B "$range" | sed -E "s#$paths_re##g" | grep -inE "$ai_re")
[[ -z "$hits" ]] && echo "ok: no AI attribution in commit messages" || bad "AI attribution in commit messages:"$'\n'"$hits"
# Paths such as .claude/ and CLAUDE.md legitimately contain the word; only added lines are checked.
hits=$(git diff "origin/main...$B" | grep -E '^\+[^+]' | grep -iE "$ai_re" | grep -viE '\.claude/|CLAUDE\.md|claude-(code|opus|sonnet|haiku)')
[[ -z "$hits" ]] && echo "ok: no AI attribution in the diff" || echo "REVIEW: possible AI mentions in added lines:"$'\n'"$hits"

types='feat|fix|test|refactor|perf|style|docs|build|ci|chore'
scopes='ui|model|i18n|storage|ml|sensors|tests|e2e|unit|ci|docs|deps|agents'
section
for sha in $(git rev-list --reverse "$range"); do
  subj=$(git log -1 --format=%s "$sha"); body=$(git log -1 --format=%b "$sha")
  short=$(git rev-parse --short "$sha")
  [[ "$subj" =~ ^($types)\(($scopes)\)!?:\ [a-z0-9] ]] || bad "$short subject not '<type>(<scope>): lowercase…': $subj"
  [[ ${#subj} -le 72 ]] || bad "$short subject is ${#subj} chars (max 72)"
  [[ "$subj" != *. ]] || bad "$short subject ends with a period"
  [[ -n "${body//[[:space:]]/}" ]] || echo "REVIEW: $short has no body: $subj"
done
clean && echo "ok: commit messages"

if [[ -n "$N" ]]; then
  git log -1 --format=%B "$B" | grep -qE "^Fixes #$N\b" && echo "ok: last commit has Fixes #$N" || bad "last commit has no 'Fixes #$N' footer"
fi

stray=$(git diff --name-only "origin/main...$B" | grep -E '(^|/)(test-results|playwright-report|dist)/|\.(png|jpg|log|orig)$|(^|/)tmp|\.sh$' | grep -vE '^scripts/|^e2e/__screenshots__/')
[[ -z "$stray" ]] && echo "ok: no stray files" || bad "possible stray files:"$'\n'"$stray"

# Backstop for the src/domain overrides in biome.json, which `npm run lint` enforces.
dom=$(grep -rnE "(^|[^.[:alnum:]_])(document|window|localStorage)\.[a-zA-Z]|from '\.\./(ui|i18n|storage)" "$ROOT/src/domain" 2>/dev/null | sed "s#$ROOT/##")
[[ -z "$dom" ]] && echo "ok: src/domain is pure" || bad "src/domain imports DOM/i18n/storage:"$'\n'"$dom"

[[ $fail -eq 0 ]] && echo "hygiene: ok" || echo "hygiene: FAILED"
exit $fail

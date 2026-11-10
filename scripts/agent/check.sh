#!/usr/bin/env bash
# Runs the required checks in the checkout this script lives in and prints one
# line per step. A failing step also prints the tail of its log; full logs stay
# in the directory printed at the end.
#
#   check.sh                 typecheck, unit, e2e, build
#   check.sh --prototype     the same, plus e2e against reference/index.html
#   check.sh unit e2e        only the named steps (typecheck|unit|e2e|prototype|build)
#
# Each Playwright run gets its own free port (E2E_PORT), so it never reuses a
# server from another worktree. Exit code is non-zero if any step failed.
. "$(dirname "$0")/lib.sh"

steps=()
for a in "$@"; do
  case $a in
    --prototype) steps=(typecheck unit e2e prototype build) ;;
    typecheck|unit|e2e|prototype|build) steps+=("$a") ;;
    *) die "unknown step: $a" ;;
  esac
done
[[ ${#steps[@]} -gt 0 ]] || steps=(typecheck unit e2e build)

cd "$ROOT" || exit 1
load_node
LOGS=$(mktemp -d /tmp/wtc-check.XXXXXX)
failed=0

summary() { # <log> -> pass/fail/skip counts from vitest or playwright output
  strip_ansi < "$1" | grep -E '^ *(Tests +[0-9]+|[0-9]+ (passed|failed|skipped|flaky))' | tr -s ' ' | tr '\n' ' '
}

for s in "${steps[@]}"; do
  log="$LOGS/$s.log"
  case $s in
    typecheck) npm run -s typecheck >"$log" 2>&1 ;;
    unit) npm run -s test:unit >"$log" 2>&1 ;;
    e2e) E2E_PORT=$(free_port) npm run -s test:e2e >"$log" 2>&1 ;;
    prototype) E2E_PORT=$(free_port) npm run -s test:e2e:prototype >"$log" 2>&1 ;;
    build) npm run -s build >"$log" 2>&1 ;;
  esac
  rc=$?
  if [[ $rc -eq 0 ]]; then
    echo "$s: ok $(summary "$log")"
  else
    failed=1
    echo "$s: FAILED (exit $rc) $(summary "$log")"
    # drop passing tests, stack frames, blank lines and trace hints; keep the failures
    strip_ansi < "$log" | grep -vE '^\s*(✓|-  |at |$)|show-trace|attachment #|trace\.zip|Usage:|─{10}' | tail -40 | sed 's/^/    /'
  fi
done

echo "logs: $LOGS"
exit $failed

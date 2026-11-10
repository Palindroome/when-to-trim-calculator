#!/usr/bin/env bash
# Usage: new-issue.sh <body.md> <label> [<label>...]
# Files an issue. The first line of body.md is the title ("# Title" or plain
# text); the rest is the body. Keeping the title in the file means the caller
# never has to quote it through PowerShell.
# Labels must already exist on GitHub (see the label table in CLAUDE.md).
. "$(dirname "$0")/lib.sh"

F="${1:-}"; shift || true
[[ -f "$F" && $# -gt 0 ]] || die "usage: new-issue.sh <body.md> <label> [<label>...]"

title=$(head -1 "$F" | sed -E 's/^#+ *//; s/\r$//')
[[ -n "$title" ]] || die "first line of $F must be the title"
body=$(mktemp /tmp/wtc-issue-body.XXXXXX)
tail -n +2 "$F" | sed -E 's/\r$//' | sed '/./,$!d' > "$body"   # drop CRs and leading blank lines

existing=$(gh label list -R "$REPO" --limit 100 --json name --template '{{range .}}{{.name}}{{"\n"}}{{end}}')
args=()
for l in "$@"; do
  grep -qxF "$l" <<< "$existing" || die "label '$l' does not exist on GitHub (create it only if CLAUDE.md lists it)"
  args+=(--label "$l")
done

gh issue create -R "$REPO" --title "$title" --body-file "$body" "${args[@]}"
rc=$?
rm -f "$body"
exit $rc

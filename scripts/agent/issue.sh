#!/usr/bin/env bash
# Usage: issue.sh N
# Prints issue N (title, state, labels, assignees, body, comments) as Markdown
# and saves the same text to /tmp/wtc-issue-N.md, so later steps can re-read
# the file instead of calling gh again.
# Plain `gh issue view N` prints nothing when stdout is not a terminal, and
# --jq expressions get mangled by PowerShell, which is why this script exists.
. "$(dirname "$0")/lib.sh"

N="${1:-}"
[[ "$N" =~ ^[0-9]+$ ]] || die "usage: issue.sh N"
OUT="/tmp/wtc-issue-$N.md"

gh issue view "$N" -R "$REPO" --json number,title,state,labels,assignees,body,comments --template \
'# #{{.number}} {{.title}}
State: {{.state}} · Labels: {{range $i, $l := .labels}}{{if $i}}, {{end}}{{$l.name}}{{end}} · Assignees: {{range $i, $a := .assignees}}{{if $i}}, {{end}}{{$a.login}}{{end}}

{{.body}}
{{range .comments}}
---
**Comment by {{.author.login}}, {{.createdAt}}**

{{.body}}
{{end}}' > "$OUT" || die "gh issue view $N failed"

cat "$OUT"
echo
echo "(saved to $OUT)"

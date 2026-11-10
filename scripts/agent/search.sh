#!/usr/bin/env bash
# Usage: search.sh <keywords...>
# Lists open and closed issues matching the keywords (all words joined into
# one search), so callers need no quoting. Run once per idea, e.g.
#   search.sh dark mode
#   search.sh date picker
. "$(dirname "$0")/lib.sh"

[[ $# -gt 0 ]] || die "usage: search.sh <keywords...>"
gh issue list -R "$REPO" --state all --limit 30 --search "$*" \
  --json number,state,title,labels --template \
  '{{range .}}#{{.number}} [{{.state}}] {{.title}} ({{range $i, $l := .labels}}{{if $i}}, {{end}}{{$l.name}}{{end}}){{"\n"}}{{end}}'

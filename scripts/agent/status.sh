#!/usr/bin/env bash
# Sets the single status:* label on an issue, removing any other status label.
#
#   status.sh N in-progress|needs-validation|validated|changes-requested [--assign]
#
# --assign also assigns the issue to the current gh user (claiming it).
# The status labels already exist on GitHub; this script never creates labels.
. "$(dirname "$0")/lib.sh"

N="${1:-}"; S="${2:-}"
[[ "$N" =~ ^[0-9]+$ ]] || die "usage: status.sh N <status> [--assign]"
target="status:$S"
[[ " ${STATUS_LABELS[*]} " == *" $target "* ]] || die "unknown status '$S' (in-progress|needs-validation|validated|changes-requested)"

args=(--add-label "$target")
[[ "${3:-}" == "--assign" ]] && args+=(--add-assignee @me)
current=$(gh issue view "$N" -R "$REPO" --json labels --template '{{range .labels}}{{.name}}{{"\n"}}{{end}}') || die "cannot read issue $N"
while read -r l; do
  [[ "$l" == status:* && "$l" != "$target" ]] && args+=(--remove-label "$l")
done <<< "$current"

gh issue edit "$N" -R "$REPO" "${args[@]}" >/dev/null || die "gh issue edit failed"
gh issue view "$N" -R "$REPO" --json labels,assignees --template \
  'labels: {{range $i, $l := .labels}}{{if $i}}, {{end}}{{$l.name}}{{end}} · assignees: {{range $i, $a := .assignees}}{{if $i}}, {{end}}{{$a.login}}{{end}}{{"\n"}}'

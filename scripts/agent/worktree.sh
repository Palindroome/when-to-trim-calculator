#!/usr/bin/env bash
# Creates or reuses a worktree under ~/wtc-worktrees and runs `npm ci` in it.
#
#   worktree.sh <branch>             work on <branch>: reuse its worktree, or check out
#                                    the existing branch, or create it from origin/main
#   worktree.sh --validate <branch>  fresh detached worktree validate-<branch> (recreated)
#   worktree.sh --main               fresh detached worktree validate-main at origin/main
#                                    (to reproduce a bug before the fix)
#   worktree.sh --remove <path>      remove a worktree you created
#
# Prints the worktree path on the last line.
. "$(dirname "$0")/lib.sh"

mode=work
case "${1:-}" in
  --validate) mode=validate; shift ;;
  --main) mode=main ;;
  --remove) mode=remove; shift ;;
  ""|-*) die "usage: worktree.sh <branch> | --validate <branch> | --main | --remove <path>" ;;
esac

cd "$MAIN_CHECKOUT" || die "no checkout at $MAIN_CHECKOUT"

if [[ $mode == remove ]]; then
  [[ -n "${1:-}" ]] || die "usage: worktree.sh --remove <path>"
  git worktree remove --force "$1" && echo "removed $1"
  exit $?
fi

git fetch -q origin || die "git fetch failed"

fresh_detached() { # <dir> <ref>
  if [[ -d "$1" ]]; then git worktree remove --force "$1" >/dev/null 2>&1 || rm -rf "$1"; fi
  git worktree prune
  git worktree add -q --detach "$1" "$2" || die "worktree add $1 failed"
}

case $mode in
  work)
    B="$1"
    existing=$(git worktree list --porcelain | awk -v b="refs/heads/$B" '/^worktree /{p=$2} $0=="branch " b {print p}')
    if [[ -n "$existing" ]]; then
      DIR="$existing"; echo "reusing worktree $DIR"
    elif git show-ref -q --verify "refs/heads/$B"; then
      DIR="$WORKTREES/$B"; git worktree add -q "$DIR" "$B" || die "worktree add failed"
      echo "checked out existing branch $B"
    else
      DIR="$WORKTREES/$B"; git worktree add -q "$DIR" -b "$B" origin/main || die "worktree add failed"
      echo "created $B from origin/main ($(git rev-parse --short origin/main))"
    fi ;;
  validate)
    B="$1"; DIR="$WORKTREES/validate-${B//\//-}"
    ref="$B"; git show-ref -q --verify "refs/heads/$B" || ref="origin/$B"
    fresh_detached "$DIR" "$ref"
    echo "validating $B at $(git -C "$DIR" rev-parse --short HEAD)" ;;
  main)
    DIR="$WORKTREES/validate-main"
    fresh_detached "$DIR" origin/main
    echo "origin/main at $(git -C "$DIR" rev-parse --short HEAD)" ;;
esac

cd "$DIR" || die "cannot cd to $DIR"
load_node
if ! npm ci --silent --no-audit --no-fund >/tmp/wtc-npm-ci.$$.log 2>&1; then
  tail -30 /tmp/wtc-npm-ci.$$.log; die "npm ci failed"
fi
rm -f /tmp/wtc-npm-ci.$$.log
echo "npm ci ok"
echo "$DIR"

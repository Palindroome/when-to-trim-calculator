# shellcheck shell=bash
# Shared helpers for the agent scripts. Sourced, not run.
# The scripts exist so agents never have to pass quoted shell through
# PowerShell -> wsl, which mangles ", |, ( and $(...).

set -uo pipefail

REPO=Palindroome/when-to-trim-calculator
MAIN_CHECKOUT="$HOME/when-to-trim-calculator"
WORKTREES="$HOME/wtc-worktrees"
STATUS_LABELS=(status:in-progress status:needs-validation status:changes-requested status:validated)

# Repository root of the checkout this script lives in.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

load_node() {
  # nvm is not on PATH in non-interactive shells.
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || { echo "nvm not found" >&2; exit 1; }
}

free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'
}

port_listening() { ss -ltn | grep -q ":$1 "; }

strip_ansi() { sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }

die() { echo "error: $*" >&2; exit 1; }

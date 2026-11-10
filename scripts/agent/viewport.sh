#!/usr/bin/env bash
# Builds the checkout this script lives in, serves it on a free port, and
# checks the page at 320, 375 and 1280 px: horizontal overflow, whether the
# result renders, and console/page errors. Stops its own server afterwards.
#
#   viewport.sh                      default widths, fresh storage
#   viewport.sh --shots DIR          also save full-page screenshots to DIR
#   viewport.sh --keep               leave the server running and print how to stop it
#   viewport.sh --widths 320,768     custom widths
. "$(dirname "$0")/lib.sh"

shots=""; keep=0; widths="320,375,1280"
while [[ $# -gt 0 ]]; do
  case $1 in
    --shots) shots="$2"; shift 2 ;;
    --keep) keep=1; shift ;;
    --widths) widths="$2"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done

cd "$ROOT" || exit 1
load_node
npm run -s build >/tmp/wtc-viewport-build.$$.log 2>&1 || { tail -30 /tmp/wtc-viewport-build.$$.log; die "build failed"; }
rm -f /tmp/wtc-viewport-build.$$.log

P=$(free_port)
PIDFILE="/tmp/wtc-preview-$P.pid"
# Run the vite binary directly: with npx, $! is the wrapper and killing it leaves vite listening.
"$ROOT/node_modules/.bin/vite" preview --host 127.0.0.1 --port "$P" --strictPort >/dev/null 2>&1 &
echo $! > "$PIDFILE"

stop_server() {
  kill "$(cat "$PIDFILE")" 2>/dev/null; rm -f "$PIDFILE"
  for _ in 1 2 3 4 5; do port_listening "$P" || break; sleep 0.5; done
  if port_listening "$P"; then echo "WARNING: port $P still listening"; else echo "server on $P stopped"; fi
}

for _ in $(seq 1 40); do port_listening "$P" && break; sleep 0.25; done
port_listening "$P" || { stop_server; die "preview server did not start"; }
URL="http://127.0.0.1:$P/"
echo "serving $URL"

node "$ROOT/scripts/agent/viewport.mjs" "$URL" "$widths" "$shots"
rc=$?

if [[ $keep -eq 1 ]]; then
  echo "server left running; stop it with: kill \$(cat $PIDFILE); rm $PIDFILE"
else
  stop_server
fi
exit $rc

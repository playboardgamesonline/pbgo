#!/usr/bin/env bash
# A stand-in for curl, for the tests of scripts/lib.sh, go-live.sh and setup-env.sh (go-live-script.test.ts): nothing leaves the machine.
# It answers from the routes file $FAKE_CURL_ROUTES, one route a line, "<METHOD or *> <text> <status> <body>": the first route whose method fits and whose text
# is found in the URL, or in the config given on stdin (`-K -`, where the scripts put a token), answers; no route is a 200 with `{}`. Each call is logged to $FAKE_CURL_LOG.
all="$*"; method=GET; url=""; out=""; fmt=""; cfg=0
while [ $# -gt 0 ]; do
  case "$1" in
    -X) method="$2"; shift ;;
    -o) out="$2"; shift ;;
    -w) fmt="$2"; shift ;;
    -K) cfg=1; shift ;;
    -H | -d | -m | --data-binary) shift ;;
    http*) url="$1" ;;
  esac
  shift
done
stdin=""; [ "$cfg" = 0 ] || stdin="$(cat)"
code=200; body='{}'
while IFS= read -r line; do
  [ -n "$line" ] || continue
  read -r route_method text status rest <<< "$line"
  [ "$route_method" = "*" ] || [ "$route_method" = "$method" ] || continue
  case "$url $stdin" in *"$text"*) code="$status"; body="${rest:-\{\}}"; break ;; esac
done < "$FAKE_CURL_ROUTES"
printf '%s %s\n  args: %s\n  stdin: %s\n' "$method" "$url" "$all" "$stdin" >> "$FAKE_CURL_LOG"
if [ -n "$out" ] && [ "$out" != /dev/null ]; then printf '%s' "$body" > "$out"
elif [ -z "$fmt" ]; then printf '%s' "$body"; fi
[ -z "$fmt" ] || printf '%s' "$code"
exit 0

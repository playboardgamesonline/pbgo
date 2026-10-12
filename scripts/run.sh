#!/usr/bin/env bash
# pnpm dev [<game>]      the web app (hub and every game) on http://localhost:3100; <game> only prints its URL
# pnpm dev:studio <game> the game's Sanity studio (game = folder of games/, or "template")
set -euo pipefail
cmd="$1"; slug="${2:-}"
case "$cmd" in
  dev)
    echo "Hub: http://localhost:3100${slug:+   ·   $slug: http://localhost:3100/$slug}"
    exec pnpm --filter web dev
    ;;
  dev:studio)
    [ -z "$slug" ] && { echo "Usage: pnpm dev:studio <game>   e.g. pnpm dev:studio courtisans"; ls games; exit 1; }
    exec pnpm --filter "$slug-studio" dev
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    exit 1
    ;;
esac

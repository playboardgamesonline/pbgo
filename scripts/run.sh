#!/usr/bin/env bash
# pnpm dev <jeu>  ·  pnpm dev:studio <jeu>   (jeu = dossier de games/, ou "template")
set -euo pipefail
cmd="$1"; slug="${2:-}"
[ -z "$slug" ] && { echo "Usage : pnpm $cmd <jeu>   ex. pnpm $cmd skull-king"; ls games; exit 1; }
if [ "$slug" = hanabi ]; then
  [ "$cmd" = dev ] && exec pnpm --filter hanabi-web dev || exec pnpm --filter hanabi-studio dev
fi
app=web; [ "$cmd" = dev:studio ] && app=studio
exec pnpm --filter "$slug-$app" dev

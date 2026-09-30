#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "Usage : pnpm add-game <slug> [--push]"; exit 1; }
PUSH=0; [ "${2:-}" = "--push" ] && PUSH=1
SECRETS="${PBGO_SECRETS:-$HOME/.config/pbgo/secrets.env}"
if [ ! -f "$SECRETS" ]; then
  echo "Fichier de secrets absent : $SECRETS"
  echo "Crée-le (voir CLAUDE.md, section Nouveau jeu) : ADMIN_LOGIN, ADMIN_PASSWORD, SUPABASE_ACCESS_TOKEN"
  exit 1
fi
bash scripts/new-game.sh "$SLUG"
bash scripts/go-live.sh "$SLUG"
if [ "$PUSH" = 1 ]; then
  git add -A
  git commit -m "feat($SLUG): nouveau jeu"
  git push origin HEAD:main
  echo "Poussé : Vercel déploie $SLUG"
else
  echo "Reste à faire : git add -A, git commit, git push (main) pour déployer"
fi

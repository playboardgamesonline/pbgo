#!/usr/bin/env bash
# pnpm add-game <slug> [--push]   e.g. pnpm add-game the-crew --push
# A new game in one command: new-game (games/<slug> from the template, registered in packages/games), go-live (Sanity
# project, studio, write token), setup-env (pending Supabase migrations, apps/web/.env.local, variables pushed to Vercel).
# The game is not live.
# --push: commits the new game and pushes the current branch (a new branch named after the game when on main), ready
# for a pull request. Env files, .sanity-project-id and .vercel stay out of the commit (git-ignored, checked again).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
SLUG="${1:-}"; PUSH=0
case "${2:-}" in "") ;; --push) PUSH=1 ;; *) SLUG="" ;; esac
[ -n "$SLUG" ] && [ $# -le 2 ] || { echo "Usage: pnpm add-game <slug> [--push]"; exit 1; }
# setup-env runs last (it needs the Sanity project that go-live creates), so check its prerequisites (Supabase values, Vercel team) now, before anything is created
bash scripts/setup-env.sh --check
if [ "$PUSH" = 1 ] && [ -n "$(git status --porcelain)" ]; then
  echo "--push needs a clean working tree (the commit holds the new game only): commit or stash first"; exit 1
fi

bash scripts/new-game.sh "$SLUG"
bash scripts/go-live.sh "$SLUG"
bash scripts/setup-env.sh

if [ "$PUSH" = 0 ]; then
  echo
  echo "Left to do: commit games/$SLUG, apps/web/public/$SLUG, packages/games, apps/web/.env.example and pnpm-lock.yaml,"
  echo "then push a branch and open a pull request (or rerun with --push)"
  exit 0
fi

[ "$(git branch --show-current)" = main ] && git switch -c "$SLUG"
git add "games/$SLUG" "apps/web/public/$SLUG" packages/games apps/web/.env.example pnpm-lock.yaml
LEAKS="$(git diff --cached --name-only | grep -E '(^|/)(\.env|\.env\..*\.local|\.env\.local|\.sanity-project-id)$|(^|/)\.vercel/' || true)"
if [ -n "$LEAKS" ]; then
  git reset -q
  echo "Not committed, these files must stay local:"; echo "$LEAKS"; exit 1
fi
git commit -q -m "✨($SLUG): new game from the template"
git push -u origin HEAD
echo "Pushed $(git branch --show-current): open a pull request, $SLUG stays off production until live: true in the registry"

#!/usr/bin/env bash
set -euo pipefail
TEAM="${VERCEL_TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
LIVE=" ${*:-courtisans} "
TOKEN=""
for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
  [ -f "$f" ] && TOKEN="$(node -e 'console.log(require(process.argv[1]).token||"")' "$f")" && break
done
[ -n "$TOKEN" ] || { echo "Token Vercel introuvable : lance d'abord npx vercel login"; exit 1; }
GAMES="sky-team welcome-to odin cry-baby trio courtisans play-game-online-template hanabi skull-king flip-7 love-letter timebomb omens skyjo dracula-vs-van-helsing 6-nimmt 7-wonders exploding-kittens"
for p in $GAMES; do
  if [[ "$LIVE" == *" $p "* ]]; then CMD="git diff --quiet HEAD^ HEAD -- ':/games/$p' ':/packages' ':/pnpm-lock.yaml'"; else CMD="exit 0"; fi
  body="$(node -e 'console.log(JSON.stringify({commandForIgnoringBuildStep:process.argv[1]}))' "$CMD")"
  code="$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "https://api.vercel.com/v9/projects/$p?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body")"
  case "$code" in 200) echo "ok      $p ($CMD)";; 404) echo "absent  $p";; *) echo "erreur  $p ($code)";; esac
done

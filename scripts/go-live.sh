#!/usr/bin/env bash
# Met un jeu du monorepo en ligne : projet Sanity + CORS + studio, projet Vercel relié au monorepo
# (root games/<jeu>/apps/web) + domaine play-<jeu>-online.vercel.app, puis variables d'env (setup-env).
# Usage : pnpm go-live <jeu>      Relançable : chaque étape déjà faite est sautée.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
SLUG="${1:-}"; DIR="games/$SLUG"
[ -n "$SLUG" ] && [ -d "$DIR/apps/web" ] || { echo "Usage : pnpm go-live <jeu>  (games/<jeu>/apps/web doit exister)"; exit 1; }
GH_REPO="${GH_REPO:-aurelienlouvel/play-game-online}"
VERCEL_TEAM="${VERCEL_TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
SANITY_API="https://api.sanity.io/v2021-06-07"
DOMAIN="play-$SLUG-online.vercel.app"

ok()    { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()   { printf "  \033[31m✗\033[0m %s\n" "$*"; }
title() { printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$*"; }
json()  { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=($1);console.log(v??'')}catch{console.log('')}})"; }
for t in node pnpm git curl; do command -v "$t" >/dev/null || { echo "$t manquant (brew install $t)"; exit 1; }; done
echo "Jeu : $SLUG  ·  site : https://$DOMAIN"

# ---------- Sanity ----------
title "Sanity"
sanity_token() { node -e 'try{console.log(require(require("os").homedir()+"/.config/sanity/config.json").authToken||"")}catch{console.log("")}'; }
STOKEN="$(sanity_token)"; [ -z "$STOKEN" ] && { npx -y sanity@latest login; STOKEN="$(sanity_token)"; }
[ -z "$STOKEN" ] && { err "Token Sanity introuvable"; exit 1; }
S() { curl -s -H "Authorization: Bearer $STOKEN" -H "Content-Type: application/json" "$@"; }
PID="$(cat "$DIR/.sanity-project-id" 2>/dev/null)"
if [ -z "$PID" ]; then
  ORG_ID="$(S "$SANITY_API/organizations" | json "o.find(x=>[x.name,x.slug].some(n=>(n||'').toLowerCase()==='main'))?.id")"
  [ -z "$ORG_ID" ] && ORG_ID="$(S "$SANITY_API/projects/2lo2f5sv" | json "o.organizationId")"
  PID="$(S "$SANITY_API/projects" | json "o.find(p=>p.displayName==='$SLUG')?.id")"
  if [ -z "$PID" ]; then
    RES="$(S -X POST "$SANITY_API/projects" -d "{\"displayName\":\"$SLUG\",\"organizationId\":\"$ORG_ID\"}")"
    PID="$(echo "$RES" | json "o.id")"
    [ -n "$PID" ] || { err "création du projet Sanity impossible (max 5 nouveaux projets par heure) : $RES"; exit 1; }
  fi
fi
ok "Projet Sanity : $SLUG ($PID)"
echo "$PID" > "$DIR/.sanity-project-id"
S -X PUT "$SANITY_API/projects/$PID/datasets/production" -d '{"aclMode":"public"}' >/dev/null
for origin in "https://$DOMAIN" "http://localhost:3000"; do
  S -X POST "$SANITY_API/projects/$PID/cors" -d "{\"origin\":\"$origin\",\"allowCredentials\":false}" >/dev/null
done
[ -f "$DIR/apps/studio/.env" ] || printf "SANITY_STUDIO_PROJECT_ID=%s\nSANITY_STUDIO_DATASET=production\nSANITY_STUDIO_HOST=%s\n" "$PID" "$SLUG" > "$DIR/apps/studio/.env"
ok "Dataset production + CORS"

# ---------- Vercel ----------
title "Vercel"
vercel_token() { for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
  [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token||"")' "$f" && return; done; }
npx -y vercel@latest whoami >/dev/null 2>&1 || npx -y vercel@latest login
VTOKEN="$(vercel_token)"; [ -z "$VTOKEN" ] && { err "Token Vercel introuvable"; exit 1; }
V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }
VID="$(V "https://api.vercel.com/v9/projects/$SLUG?teamId=$VERCEL_TEAM" | json "o.id")"
if [ -z "$VID" ]; then
  RES="$(V -X POST "https://api.vercel.com/v11/projects?teamId=$VERCEL_TEAM" -d "{\"name\":\"$SLUG\",\"framework\":\"nextjs\",\"rootDirectory\":\"$DIR/apps/web\",\"enableAffectedProjectsDeployments\":true,\"gitRepository\":{\"type\":\"github\",\"repo\":\"$GH_REPO\"}}")"
  VID="$(echo "$RES" | json "o.id")"
  [ -n "$VID" ] && ok "Projet Vercel créé : $SLUG (relié à $GH_REPO)" || { err "projet Vercel : $RES"; exit 1; }
else ok "Projet Vercel : $SLUG"; fi
RES="$(V -X POST "https://api.vercel.com/v10/projects/$SLUG/domains?teamId=$VERCEL_TEAM" -d "{\"name\":\"$DOMAIN\"}")"
if [ -n "$(echo "$RES" | json "o.name")" ] || echo "$RES" | grep -q "already"; then ok "Domaine : $DOMAIN"
else warn "Domaine $DOMAIN : $(echo "$RES" | json "o.error?.message")"; fi
mkdir -p "$DIR/.vercel" && echo "{\"projectId\":\"$VID\",\"orgId\":\"$VERCEL_TEAM\",\"projectName\":\"$SLUG\"}" > "$DIR/.vercel/project.json"

# ---------- Studio ----------
title "Studio Sanity"
pnpm install --silent >/dev/null 2>&1 || warn "pnpm install a signalé une erreur"
if (cd "$DIR/apps/studio" && SANITY_AUTH_TOKEN="$STOKEN" npx sanity deploy -y >/tmp/sanity-$SLUG.log 2>&1); then
  ok "Studio : https://$(grep SANITY_STUDIO_HOST "$DIR/apps/studio/.env" | cut -d= -f2).sanity.studio"
else err "studio (voir /tmp/sanity-$SLUG.log — hôte pris ? change SANITY_STUDIO_HOST dans $DIR/apps/studio/.env)"; fi

# ---------- Variables d'env ----------
if [ -f "$DIR/scripts/setup-env.sh" ]; then title "Variables d'environnement"; bash "$DIR/scripts/setup-env.sh"; fi
echo; echo "Commit + push sur main pour déployer : https://$DOMAIN"

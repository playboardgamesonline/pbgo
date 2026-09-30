#!/usr/bin/env bash
# Met ce repo en ligne de A à Z, sans toucher aux fichiers suivis par git :
#   repo GitHub privé + push, projet Sanity + CORS + studio, projet Vercel relié au repo (root apps/web) + domaine,
#   puis enchaîne sur scripts/setup-env.sh (clés, compte admin, variables Vercel, redéploiement).
# Noms : play-board-games-online-template → play-board-games-online-template.vercel.app ; skull-king → play-skull-king-online.vercel.app
# Usage, depuis la racine du repo :  pnpm go-live
# Relançable : chaque étape déjà faite est sautée.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
GH_USER="${GH_USER:-aurelienlouvel}"
VERCEL_TEAM="${VERCEL_TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
VERCEL_SCOPE="${VERCEL_SCOPE:-ore}"
SANITY_API="https://api.sanity.io/v2021-06-07"

SLUG="$(basename "$ROOT")"
if [[ "$SLUG" == play-* ]]; then DOMAIN="$SLUG.vercel.app"; else DOMAIN="play-$SLUG-online.vercel.app"; fi

ok()    { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()   { printf "  \033[31m✗\033[0m %s\n" "$*"; }
title() { printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$*"; }
json()  { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=($1);console.log(v??'')}catch{console.log('')}})"; }

for t in gh node pnpm git curl; do command -v "$t" >/dev/null || { echo "$t manquant (brew install $t)"; exit 1; }; done
[ -d apps/web ] || { echo "Lance ce script depuis la racine d'un repo de jeu (apps/web introuvable)"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login

echo "Repo : $GH_USER/$SLUG  ·  site : https://$DOMAIN"

# ---------- Sanity : projet + dataset + CORS ----------
title "Sanity"
sanity_token() { node -e 'try{console.log(require(require("os").homedir()+"/.config/sanity/config.json").authToken||"")}catch{console.log("")}'; }
STOKEN="$(sanity_token)"
[ -z "$STOKEN" ] && { npx -y sanity@latest login; STOKEN="$(sanity_token)"; }
[ -z "$STOKEN" ] && { err "Token Sanity introuvable"; exit 1; }
S() { curl -s -H "Authorization: Bearer $STOKEN" -H "Content-Type: application/json" "$@"; }

PID="$(cat .sanity-project-id 2>/dev/null)"
if [ -z "$PID" ]; then
  ORG_ID="$(S "$SANITY_API/organizations" | json "o.find(x=>[x.name,x.slug].some(n=>(n||'').toLowerCase()==='main'))?.id")"
  [ -z "$ORG_ID" ] && ORG_ID="$(S "$SANITY_API/projects/2lo2f5sv" | json "o.organizationId")"
  PID="$(S "$SANITY_API/projects" | json "o.find(p=>p.displayName==='$SLUG')?.id")"
  if [ -z "$PID" ]; then
    RES="$(S -X POST "$SANITY_API/projects" -d "{\"displayName\":\"$SLUG\",\"organizationId\":\"$ORG_ID\"}")"
    PID="$(echo "$RES" | json "o.id")"
    [ -n "$PID" ] && ok "Projet Sanity créé : $SLUG ($PID)" || { err "création du projet Sanity impossible : $RES"; exit 1; }
  fi
fi
ok "Projet Sanity : $SLUG ($PID)"
echo "$PID" > .sanity-project-id
S -X PUT "$SANITY_API/projects/$PID/datasets/production" -d '{"aclMode":"public"}' >/dev/null
for origin in "https://$DOMAIN" "http://localhost:3000"; do
  S -X POST "$SANITY_API/projects/$PID/cors" -d "{\"origin\":\"$origin\",\"allowCredentials\":false}" >/dev/null
done
ok "Dataset production + CORS"
[ -f apps/studio/.env ] || printf "SANITY_STUDIO_PROJECT_ID=%s\nSANITY_STUDIO_DATASET=production\nSANITY_STUDIO_HOST=%s\n" "$PID" "$SLUG" > apps/studio/.env

# ---------- GitHub : repo privé + push ----------
title "GitHub"
if gh repo view "$GH_USER/$SLUG" >/dev/null 2>&1; then ok "Repo : $GH_USER/$SLUG"
else gh repo create "$GH_USER/$SLUG" --private >/dev/null && ok "Repo créé : $GH_USER/$SLUG" || { err "création du repo impossible"; exit 1; }; fi
[ -d .git ] || git init -q -b main
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$SLUG.git"
if [ -n "$(git status --porcelain)" ]; then
  warn "Modifications non commitées (elles ne seront pas en ligne) :"
  git status --short | head -10
fi
git push -qu origin main && ok "Push sur GitHub" || err "push impossible"

# ---------- Vercel : projet relié au repo + domaine ----------
title "Vercel"
vercel_token() {
  for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
    [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token||"")' "$f" && return
  done
}
npx -y vercel@latest whoami >/dev/null 2>&1 || npx -y vercel@latest login
VTOKEN="$(vercel_token)"
[ -z "$VTOKEN" ] && { err "Token Vercel introuvable"; exit 1; }
V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }

VID="$(V "https://api.vercel.com/v9/projects/$SLUG?teamId=$VERCEL_TEAM" | json "o.id")"
GIT_LINKED=1
if [ -z "$VID" ]; then
  RES="$(V -X POST "https://api.vercel.com/v11/projects?teamId=$VERCEL_TEAM" -d "{\"name\":\"$SLUG\",\"framework\":\"nextjs\",\"rootDirectory\":\"apps/web\",\"gitRepository\":{\"type\":\"github\",\"repo\":\"$GH_USER/$SLUG\"}}")"
  VID="$(echo "$RES" | json "o.id")"
  if [ -z "$VID" ]; then
    warn "liaison GitHub refusée ($(echo "$RES" | json "o.error?.message")) → projet créé sans lien"
    GIT_LINKED=0
    VID="$(V -X POST "https://api.vercel.com/v11/projects?teamId=$VERCEL_TEAM" -d "{\"name\":\"$SLUG\",\"framework\":\"nextjs\",\"rootDirectory\":\"apps/web\"}" | json "o.id")"
  fi
  [ -n "$VID" ] && ok "Projet Vercel créé : $SLUG" || { err "projet Vercel : $RES"; exit 1; }
else
  ok "Projet Vercel : $SLUG"
  [ -z "$(V "https://api.vercel.com/v9/projects/$SLUG?teamId=$VERCEL_TEAM" | json "o.link?.repo")" ] && GIT_LINKED=0
fi
RES="$(V -X POST "https://api.vercel.com/v10/projects/$SLUG/domains?teamId=$VERCEL_TEAM" -d "{\"name\":\"$DOMAIN\"}")"
if [ -n "$(echo "$RES" | json "o.name")" ] || echo "$RES" | grep -q "already"; then ok "Domaine : $DOMAIN"
else warn "Domaine $DOMAIN : $(echo "$RES" | json "o.error?.message")"; fi
mkdir -p .vercel && echo "{\"projectId\":\"$VID\",\"orgId\":\"$VERCEL_TEAM\",\"projectName\":\"$SLUG\"}" > .vercel/project.json

# ---------- Studio Sanity ----------
title "Studio Sanity"
pnpm install --silent >/dev/null 2>&1 || warn "pnpm install a signalé une erreur"
if (cd apps/studio && SANITY_AUTH_TOKEN="$STOKEN" npx sanity deploy -y >/tmp/sanity-$SLUG.log 2>&1); then
  ok "Studio : https://$(grep SANITY_STUDIO_HOST apps/studio/.env | cut -d= -f2).sanity.studio"
else
  err "studio Sanity (voir /tmp/sanity-$SLUG.log — nom d'hôte pris ? change SANITY_STUDIO_HOST dans apps/studio/.env)"
fi

# ---------- Variables d'environnement + déploiement ----------
if [ "$GIT_LINKED" = 0 ]; then
  warn "Repo non relié à Vercel : les déploiements passeront par la CLI (setup-env le propose à la fin)"
fi
title "Variables d'environnement"
bash scripts/setup-env.sh

echo
echo "En ligne : https://$DOMAIN  ·  admin : https://$DOMAIN/admin"

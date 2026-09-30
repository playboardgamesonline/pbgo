#!/usr/bin/env bash
# Renseigne tout ce qu'il faut pour faire tourner un jeu, en posant les questions une par une :
#   Sanity (token d'écriture créé automatiquement + déploiement du schéma), Supabase (clés + migrations),
#   compte admin (/setup, /status), Vercel Web Analytics, puis écrit apps/web/.env.local et pousse tout sur Vercel.
# Usage, depuis la racine du repo du jeu :  pnpm setup:env   (ou  bash scripts/setup-env.sh)
# Relançable : Entrée garde la valeur actuelle, les étapes déjà faites sont sautées.
# Les secrets ne sont jamais affichés (sauf le mot de passe admin généré, une fois, à la fin).
#
# Mode automatique : si ~/.config/pbgo/secrets.env existe (ou PBGO_SECRETS), rien n'est demandé.
#   ADMIN_LOGIN, ADMIN_PASSWORD          compte admin commun à tous les jeux
#   SUPABASE_ACCESS_TOKEN                token perso Supabase : schéma du jeu créé, migrations appliquées, schéma exposé
#   SUPABASE_PROJECT_REF                 projet Supabase partagé par tous les jeux (sinon « pbgo » est trouvé ou créé)
#   SUPABASE_ORG_ID, SUPABASE_REGION     facultatifs, seulement si le projet partagé doit être créé
#   VERCEL_TOKEN, VERCEL_TEAM_ID         facultatifs : page Monitoring de l'admin
# Sanity est déjà automatique : le token d'écriture est créé pour chaque projet avec la connexion `sanity login`.
# Ce fichier reste sur ta machine, jamais dans le repo.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="apps/web/.env.local"
VERCEL_TEAM="${VERCEL_TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
VERCEL_SCOPE="${VERCEL_SCOPE:-ore}"
SANITY_API="https://api.sanity.io/v2021-06-07"
SECRETS_FILE="${PBGO_SECRETS:-$HOME/.config/pbgo/secrets.env}"
AUTO=0; [ -f "$SECRETS_FILE" ] && AUTO=1
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok()    { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()   { printf "  \033[31m✗\033[0m %s\n" "$*"; }
title() { printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$*"; }
json()  { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=($1);console.log(v??'')}catch{console.log('')}})"; }

for t in node pnpm curl; do command -v "$t" >/dev/null || { echo "$t manquant (brew install $t)"; exit 1; }; done
[ -d apps/web ] || { echo "Lance ce script depuis un repo de jeu (apps/web introuvable)"; exit 1; }

# ---------- lecture / écriture des fichiers .env ----------
touch "$ENV_FILE" && chmod 600 "$ENV_FILE"

envget() { # envget <fichier> <CLÉ>
  [ -f "$1" ] || return 0
  node -e '
    const [file, key] = process.argv.slice(1)
    for (const line of require("fs").readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m && m[1] === key) { console.log(m[2].trim().replace(/^(["\x27])(.*)\1$/, "$2")); break }
    }' "$1" "$2"
}

envset() { # envset <CLÉ> <valeur>  (écrit dans apps/web/.env.local, sans rien afficher)
  KEY="$1" VAL="$2" node -e '
    const fs = require("fs"), file = process.argv[1], { KEY, VAL } = process.env
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : []
    const i = lines.findIndex((l) => new RegExp(`^\\s*(export\\s+)?${KEY}\\s*=`).test(l))
    if (VAL === "") { if (i >= 0) lines.splice(i, 1) }
    else if (i >= 0) lines[i] = `${KEY}=${VAL}`
    else { while (lines.length && lines.at(-1) === "") lines.pop(); lines.push(`${KEY}=${VAL}`) }
    fs.writeFileSync(file, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 })' "$ENV_FILE"
}

secret() { envget "$SECRETS_FILE" "$1"; } # valeur du fichier de secrets (vide s'il n'existe pas)

PULLED="$TMP/vercel.env"
current() { # valeur actuelle : .env.local, sinon celle récupérée sur Vercel
  local v; v="$(envget "$ENV_FILE" "$1")"
  [ -z "$v" ] && v="$(envget "$PULLED" "$1")"
  [ -z "$v" ] && v="$(secret "$1")"
  printf "%s" "$v"
}

safe() { [[ "$1" =~ ^[A-Za-z0-9._:/@+=~-]*$ ]]; }

# ask <CLÉ> <question> [défaut] [secret|optional|secret-optional]  → écrit la réponse dans .env.local
ask() {
  local key="$1" label="$2" def="${3:-}" mode="${4:-}" cur shown answer
  cur="$(current "$key")"; [ -z "$cur" ] && cur="$def"
  # mode automatique : une valeur connue est utilisée sans poser la question
  if [ "$AUTO" = 1 ] && [ -n "$cur" ] && safe "$cur"; then envset "$key" "$cur"; ok "$key"; return; fi
  while true; do
    if [ -n "$cur" ]; then
      if [[ "$mode" == secret* ]]; then shown="••••${cur: -4}"; else shown="$cur"; fi
      printf "  %s [%s] : " "$label" "$shown"
    else
      printf "  %s%s : " "$label" "$([[ "$mode" == *optional ]] && echo " (Entrée pour passer)")"
    fi
    if [[ "$mode" == secret* ]]; then read -rs answer; echo; else read -r answer; fi
    answer="${answer:-$cur}"
    if [ -z "$answer" ] && [[ "$mode" != *optional ]]; then warn "obligatoire"; continue; fi
    if ! safe "$answer"; then warn "caractères non autorisés (espace, \$, guillemets…) — réessaie"; continue; fi
    break
  done
  envset "$key" "$answer"
}

confirm() { [ "$AUTO" = 1 ] && return 0; local a; printf "  %s [O/n] : " "$1"; read -r a; [[ -z "$a" || "$a" =~ ^[oOyY] ]]; }

SLUG="$(basename "$ROOT")"
# play-board-games-online-template → play-board-games-online-template.vercel.app ; skull-king → play-skull-king-online.vercel.app
if [[ "$SLUG" == play-* ]]; then DOMAIN="$SLUG.vercel.app"; else DOMAIN="play-$SLUG-online.vercel.app"; fi
PROJECT="$(node -e 'try{console.log(require("./.vercel/project.json").projectName||"")}catch{console.log("")}')"
PROJECT="${PROJECT:-$SLUG}"
echo "Jeu : $SLUG  ·  fichier : $ENV_FILE"

# ---------- Vercel : connexion + récupération des variables existantes ----------
title "Vercel"
vercel_token() {
  for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
    [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token||"")' "$f" && return
  done
}
VTOKEN=""
if npx -y vercel@latest whoami >/dev/null 2>&1 || npx -y vercel@latest login; then
  VTOKEN="$(vercel_token)"
fi
V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }
VID=""
if [ -n "$VTOKEN" ]; then
  VID="$(V "https://api.vercel.com/v9/projects/$PROJECT?teamId=$VERCEL_TEAM" | json "o.id")"
  if [ -n "$VID" ]; then
    ok "Projet Vercel : $PROJECT"
    mkdir -p .vercel
    [ -f .vercel/project.json ] || echo "{\"projectId\":\"$VID\",\"orgId\":\"$VERCEL_TEAM\",\"projectName\":\"$PROJECT\"}" > .vercel/project.json
    if npx -y vercel@latest env pull "$PULLED" --environment=production --yes --scope "$VERCEL_SCOPE" >/dev/null 2>&1; then
      ok "Variables existantes récupérées (servent de valeurs par défaut)"
    fi
  else
    warn "Projet Vercel « $PROJECT » introuvable (lance d'abord setup-games.sh) — on continue en local"
  fi
else
  warn "Pas connecté à Vercel — on continue en local"
fi

ask NEXT_PUBLIC_SITE_URL "URL du site" "https://$DOMAIN"
SITE_URL="$(current NEXT_PUBLIC_SITE_URL)"

# ---------- Sanity ----------
title "Sanity"
def_pid="$(cat .sanity-project-id 2>/dev/null)"
[ -z "$def_pid" ] && def_pid="$(grep -o 'projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "[a-z0-9]*"' apps/web/src/sanity/env.ts 2>/dev/null | grep -o '"[a-z0-9]*"' | tr -d '"')"
ask NEXT_PUBLIC_SANITY_PROJECT_ID "Project ID Sanity" "$def_pid"
ask NEXT_PUBLIC_SANITY_DATASET "Dataset" "production"
PID="$(current NEXT_PUBLIC_SANITY_PROJECT_ID)"

sanity_token() { node -e 'try{console.log(require(require("os").homedir()+"/.config/sanity/config.json").authToken||"")}catch{console.log("")}'; }
STOKEN="$(sanity_token)"
[ -z "$STOKEN" ] && { npx -y sanity@latest login; STOKEN="$(sanity_token)"; }
S() { curl -s -H "Authorization: Bearer $STOKEN" -H "Content-Type: application/json" "$@"; }

if [ -n "$(current SANITY_API_WRITE_TOKEN)" ]; then
  ok "Token d'écriture Sanity déjà renseigné"
elif [ -n "$STOKEN" ]; then
  KEY="$(S -X POST "$SANITY_API/projects/$PID/tokens" -d '{"label":"web /setup (editor)","roleName":"editor"}' | json "o.key")"
  if [ -n "$KEY" ]; then envset SANITY_API_WRITE_TOKEN "$KEY"; ok "Token d'écriture Sanity créé (rôle editor)"
  else err "création du token impossible — crée-le dans sanity.io/manage → API → Tokens (Editor)"; ask SANITY_API_WRITE_TOKEN "Token Sanity (Editor)" "" secret-optional; fi
else
  ask SANITY_API_WRITE_TOKEN "Token Sanity (Editor)" "" secret-optional
fi

if [ -n "$STOKEN" ] && [ -n "$SITE_URL" ]; then
  S -X POST "$SANITY_API/projects/$PID/cors" -d "{\"origin\":\"$SITE_URL\",\"allowCredentials\":false}" >/dev/null
fi

DATASET="$(current NEXT_PUBLIC_SANITY_DATASET)"
# le studio lit ces variables (apps/studio/.env, non commité) : pnpm dev:studio et les déploiements utilisent le bon projet
STUDIO_HOST="$(envget apps/studio/.env SANITY_STUDIO_HOST)"; STUDIO_HOST="${STUDIO_HOST:-$SLUG}"
printf "SANITY_STUDIO_PROJECT_ID=%s\nSANITY_STUDIO_DATASET=%s\nSANITY_STUDIO_HOST=%s\n" "$PID" "$DATASET" "$STUDIO_HOST" > apps/studio/.env
echo "$PID" > .sanity-project-id
if confirm "Déployer le schéma Sanity (champs Settings pour /setup) ?"; then
  if (cd apps/studio && SANITY_AUTH_TOKEN="$STOKEN" SANITY_STUDIO_PROJECT_ID="$PID" SANITY_STUDIO_DATASET="$DATASET" npx sanity schema deploy >"$TMP/schema.log" 2>&1); then ok "Schéma Sanity déployé"
  else err "schema deploy : $(tail -3 "$TMP/schema.log")"; fi
fi

# ---------- Supabase (projet partagé, un schéma par jeu) ----------
title "Supabase"
SB_PAT="$(secret SUPABASE_ACCESS_TOKEN)"
SBAPI="https://api.supabase.com/v1"
SB() { curl -s -H "Authorization: Bearer $SB_PAT" -H "Content-Type: application/json" "$@"; }
SCHEMA="$(current NEXT_PUBLIC_SUPABASE_SCHEMA)"
[ -z "$SCHEMA" ] && { if [ "$SLUG" = courtisans ]; then SCHEMA=public; else SCHEMA="g_$(echo "$SLUG" | tr '-' '_')"; fi; }
REF="$(current NEXT_PUBLIC_SUPABASE_URL | sed -E 's#https://([^.]+)\..*#\1#')"
[ -z "$REF" ] && REF="$(secret SUPABASE_PROJECT_REF)"

# projet partagé : celui du fichier de secrets, sinon « pbgo » (trouvé ou créé)
if [ -z "$REF" ] && [ -n "$SB_PAT" ]; then
  REF="$(SB "$SBAPI/projects" | json "o.find(p=>p.name==='pbgo')?.ref")"
  if [ -z "$REF" ]; then
    ORG="$(secret SUPABASE_ORG_ID)"; [ -z "$ORG" ] && ORG="$(SB "$SBAPI/organizations" | json "o[0]?.id")"
    REGION="$(secret SUPABASE_REGION)"; REGION="${REGION:-eu-west-3}"
    DBPW="$(node -e 'const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";console.log(Array.from(require("crypto").randomBytes(24),b=>c[b%c.length]).join(""))')"
    RES="$(SB -X POST "$SBAPI/projects" -d "{\"name\":\"pbgo\",\"organization_id\":\"$ORG\",\"db_pass\":\"$DBPW\",\"region\":\"$REGION\"}")"
    REF="$(echo "$RES" | json "o.ref ?? o.id")"
    if [ -n "$REF" ]; then ok "Projet Supabase partagé créé : pbgo ($REGION)"
    else err "création du projet Supabase : $(echo "$RES" | head -c 300)"; fi
  else ok "Projet Supabase partagé : pbgo ($REF)"; fi
  [ -n "$REF" ] && warn "Ajoute SUPABASE_PROJECT_REF=$REF à ton fichier de secrets"
fi

# clés du projet (URL, anon, service_role) quand elles ne sont pas déjà connues
if [ -n "$REF" ] && [ -n "$SB_PAT" ] && { [ -z "$(current SUPABASE_SERVICE_ROLE_KEY)" ] || [ -z "$(current NEXT_PUBLIC_SUPABASE_URL)" ]; }; then
  printf "  Démarrage du projet"
  for i in $(seq 1 60); do
    st="$(SB "$SBAPI/projects/$REF" | json "o.status")"
    [ "$st" = "ACTIVE_HEALTHY" ] && break
    printf "."; sleep 5
  done; echo
  KEYS_JSON="$(SB "$SBAPI/projects/$REF/api-keys?reveal=true")"
  ANON="$(echo "$KEYS_JSON" | json "o.find(k=>k.name==='anon')?.api_key")"
  SERVICE="$(echo "$KEYS_JSON" | json "o.find(k=>k.name==='service_role')?.api_key")"
  if [ -n "$ANON" ] && [ -n "$SERVICE" ]; then
    envset NEXT_PUBLIC_SUPABASE_URL "https://$REF.supabase.co"; envset NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON"; envset SUPABASE_SERVICE_ROLE_KEY "$SERVICE"
    ok "URL et clés Supabase renseignées"
  else err "clés Supabase introuvables (projet pas encore prêt ? relance le script)"; fi
fi

if [ "$AUTO" = 1 ] && [ -n "$(current NEXT_PUBLIC_SUPABASE_URL)" ]; then
  ask NEXT_PUBLIC_SUPABASE_URL "URL du projet"; ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Clé anon" "" secret; ask SUPABASE_SERVICE_ROLE_KEY "Clé service_role" "" secret
else
  echo "  Clés : supabase.com/dashboard → ton projet → Project Settings → API"
  ask NEXT_PUBLIC_SUPABASE_URL "URL du projet (https://xxxx.supabase.co)"
  ask NEXT_PUBLIC_SUPABASE_ANON_KEY "Clé anon / publishable" "" secret
  ask SUPABASE_SERVICE_ROLE_KEY "Clé service_role / secret" "" secret
fi
envset NEXT_PUBLIC_SUPABASE_SCHEMA "$SCHEMA"
ok "Schéma du jeu : $SCHEMA"
REF="$(current NEXT_PUBLIC_SUPABASE_URL | sed -E 's#https://([^.]+)\..*#\1#')"

if [ -z "$SB_PAT" ]; then
  echo "  Pour créer le schéma d'ici : token perso sur supabase.com/dashboard/account/tokens (non enregistré)"
  printf "  Token Supabase (Entrée pour le faire à la main) : "; read -rs SB_PAT; echo
fi
sbq() { # sbq <sql> → réponse JSON de l'API ; code HTTP dans $SBCODE
  local body; body="$(node -e 'console.log(JSON.stringify({query:process.argv[1]}))' "$1")"
  SBCODE="$(curl -s -o "$TMP/sb.json" -w '%{http_code}' -X POST "$SBAPI/projects/$REF/database/query" -H "Authorization: Bearer $SB_PAT" -H "Content-Type: application/json" -d "$body")"
  cat "$TMP/sb.json"
}
if [ -n "$SB_PAT" ] && [ -n "$REF" ]; then
  # schéma + droits pour le serveur (service_role)
  sbq "create schema if not exists \"$SCHEMA\"; grant usage on schema \"$SCHEMA\" to service_role; alter default privileges in schema \"$SCHEMA\" grant all on tables to service_role; alter default privileges in schema \"$SCHEMA\" grant all on sequences to service_role;" >/dev/null
  [[ "$SBCODE" == 2* ]] && ok "Schéma $SCHEMA prêt" || err "schéma : $(head -c 200 "$TMP/sb.json")"
  # migrations, seulement si les tables du jeu manquent (le 0002 insère des tâches : pas de rejeu)
  N="$(sbq "select count(*) as n from information_schema.tables where table_schema='$SCHEMA' and table_name in ('games','tasks','feedback')" | json "o[0]?.n")"
  if [ "$N" = "3" ]; then ok "Tables games, tasks et feedback présentes"
  else
    for f in supabase/migrations/*.sql; do
      sql="$(sed "s/public\./\"$SCHEMA\"./g" "$f")"
      sbq "$sql" >/dev/null
      [[ "$SBCODE" == 2* ]] && ok "$(basename "$f") appliquée" || err "$(basename "$f") : $(head -c 200 "$TMP/sb.json")"
    done
    sbq "grant all on all tables in schema \"$SCHEMA\" to service_role" >/dev/null
  fi
  # exposition du schéma à l'API REST
  CUR="$(SB "$SBAPI/projects/$REF/postgrest" | json "o.db_schema")"
  if [ -n "$CUR" ] && [[ ",$CUR," != *",$SCHEMA,"* ]]; then
    SB -X PATCH "$SBAPI/projects/$REF/postgrest" -d "{\"db_schema\":\"$CUR,$SCHEMA\"}" >/dev/null && ok "Schéma exposé à l'API" || err "exposition du schéma"
  else ok "Schéma exposé à l'API"; fi
else
  warn "Colle supabase/migrations/*.sql (en remplaçant public. par $SCHEMA.) dans https://supabase.com/dashboard/project/$REF/sql/new, après « create schema $SCHEMA », et ajoute $SCHEMA dans Settings → API → Exposed schemas"
fi

# ---------- Compte admin ----------
title "Compte admin (/admin)"
ask ADMIN_LOGIN "Identifiant" "ore"
GENERATED=""
if [ -z "$(current ADMIN_PASSWORD)" ]; then
  pw=""
  [ "$AUTO" = 1 ] || { printf "  Mot de passe (Entrée pour en générer un) : "; read -rs pw; echo; }
  if [ -z "$pw" ]; then pw="$(node -e 'const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";console.log(Array.from(require("crypto").randomBytes(20),b=>c[b%c.length]).join(""))')"; GENERATED="$pw"; fi
  if safe "$pw"; then envset ADMIN_PASSWORD "$pw"; ok "Mot de passe enregistré"; else err "caractères non autorisés, relance le script"; fi
else
  ask ADMIN_PASSWORD "Mot de passe" "" secret
fi

# ---------- Vercel Web Analytics ----------
title "Monitoring (/admin)"
[ "$AUTO" = 1 ] || echo "  Token longue durée : vercel.com/account/settings/tokens (scope : ton équipe)"
ask VERCEL_TOKEN "Token Vercel" "" secret-optional
[ -n "$(current VERCEL_TOKEN)" ] && ask VERCEL_TEAM_ID "Team ID" "$VERCEL_TEAM"
[ -n "$VID" ] && [ -z "$(current VERCEL_ANALYTICS_PROJECT_ID)" ] && envset VERCEL_ANALYTICS_PROJECT_ID "$VID"
echo "  Pense à activer Web Analytics : https://vercel.com/$VERCEL_SCOPE/$PROJECT/analytics"

ok "Écrit dans $ENV_FILE"

# ---------- Envoi sur Vercel ----------
KEYS=(NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SANITY_PROJECT_ID NEXT_PUBLIC_SANITY_DATASET SANITY_API_WRITE_TOKEN
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_SCHEMA
  ADMIN_LOGIN ADMIN_PASSWORD VERCEL_TOKEN VERCEL_TEAM_ID VERCEL_ANALYTICS_PROJECT_ID)
if [ -n "$VID" ] && confirm "Envoyer ces variables sur Vercel (production, preview, development) ?"; then
  title "Envoi sur Vercel"
  for k in "${KEYS[@]}"; do
    v="$(envget "$ENV_FILE" "$k")"
    [ -z "$v" ] && continue
    type="encrypted"; [[ "$k" == NEXT_PUBLIC_* ]] && type="plain"
    body="$(K="$k" VAL="$v" T="$type" node -e 'const {K,VAL,T}=process.env;console.log(JSON.stringify({key:K,value:VAL,type:T,target:["production","preview","development"]}))')"
    res="$(V -X POST "https://api.vercel.com/v10/projects/$VID/env?upsert=true&teamId=$VERCEL_TEAM" -d "$body")"
    if [ -n "$(echo "$res" | json "o.error?.message")" ]; then err "$k : $(echo "$res" | json "o.error.message")"; else ok "$k"; fi
  done
  if [ "$AUTO" = 1 ]; then
    ok "Variables en place : le prochain push sur main déploie le jeu avec elles"
  elif confirm "Redéployer la production pour appliquer les variables ?"; then
    npx -y vercel@latest deploy --prod --yes --scope "$VERCEL_SCOPE" >"$TMP/deploy.log" 2>&1 && ok "Déployé" || err "déploiement : $(tail -3 "$TMP/deploy.log")"
  fi
fi

# ---------- Récap ----------
title "Terminé"
echo "  Admin : ${SITE_URL}/admin"
echo "  Identifiant : $(current ADMIN_LOGIN)"
[ -n "$GENERATED" ] && printf "  Mot de passe généré (note-le, il n'est affiché qu'une fois) : \033[1m%s\033[0m\n" "$GENERATED"
echo "  En local : pnpm dev → http://localhost:3000/admin"

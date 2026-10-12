#!/usr/bin/env bash
# pnpm setup-env [--no-push | --check]
# Environment of apps/web (hub + every game): fills apps/web/.env.local, then pushes the variables to the Vercel
# project "playboardgamesonline". Rerunnable; secret values are never printed. Reads ~/.config/pbgo/secrets.env
# (or $PBGO_SECRETS; outside the repo, chmod 600):
#   ADMIN_LOGIN, ADMIN_PASSWORD     admin of every game (/<slug>/admin); a password is generated when there is none
#   SUPABASE_ACCESS_TOKEN           Supabase personal token: API keys read, tables created on an empty project
#   SUPABASE_PROJECT_REF            production project, shared by every game (rows carry a `game` column)
#   SUPABASE_PREVIEW_PROJECT_REF    preview project (pbgo-preview), another project than the production one
#   VERCEL_TOKEN, VERCEL_TEAM_ID    optional: admin › Audience and Health
# The three Supabase values are required. The production keys go to the Vercel production target only: .env.local and
# the Vercel preview/development targets get the preview project's keys, never production ones. The script exits with
# code 1, before writing .env.local or sending anything, when a value is missing or a project can't be used
# (unreachable, keys unreadable, tables not applied, or still the schema of one project per game: `public.games`
# without a `game` column).
#   --no-push   nothing is sent to Vercel, and the production project is not even read
#   --check     only checks the three Supabase values (no network, nothing written); add-game.sh runs it first
# Sanity: a write token SANITY_API_WRITE_TOKEN_<SLUG> (editor) is created with the `npx sanity login` session for each
# game of packages/games/src/registry.ts that has a project id and no token yet.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh
PUSH=1; CHECK=0
for a in "$@"; do case "$a" in --no-push) PUSH=0 ;; --check) CHECK=1 ;; *) echo "Usage: pnpm setup-env [--no-push | --check]"; exit 1 ;; esac; done
for t in node curl; do command -v "$t" >/dev/null || { echo "$t is missing"; exit 1; }; done
SECRETS="${PBGO_SECRETS:-$HOME/.config/pbgo/secrets.env}"
ENV_FILE="apps/web/.env.local"
PROJECT="playboardgamesonline"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
SUPABASE_KEYS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY)

secret() { envget "$SECRETS" "$1"; }
# setting <KEY>: the secrets file's value, else the one already in .env.local
setting() { local v; v="$(secret "$1")"; [ -z "$v" ] && v="$(envget "$ENV_FILE" "$1")"; printf "%s" "$v"; }

# die <message> [detail…]: the message and its details, then exit 1; .env.local and Vercel are only touched further down
die() { err "$1"; shift; for l in "$@"; do echo "      $l"; done; echo "      $ENV_FILE and Vercel were left untouched."; exit 1; }

# ---------- Supabase ----------
# Production and preview are two projects and both are required, checked before anything is written or sent: with only
# one, the production keys would end up in .env.local and in the Vercel preview and development targets
title "Supabase"
if [ -f "$SECRETS" ]; then ok "Secrets: $SECRETS"
else die "No secrets file: $SECRETS" "It holds the Supabase access token and the references of the production and preview projects (see the header of scripts/setup-env.sh)."; fi
PAT="$(secret SUPABASE_ACCESS_TOKEN)"
PROD_REF="$(secret SUPABASE_PROJECT_REF)"
PREVIEW_REF="$(secret SUPABASE_PREVIEW_PROJECT_REF)"
MISSING=""
[ -n "$PAT" ] || MISSING="$MISSING SUPABASE_ACCESS_TOKEN"
[ -n "$PROD_REF" ] || MISSING="$MISSING SUPABASE_PROJECT_REF"
[ -n "$PREVIEW_REF" ] || MISSING="$MISSING SUPABASE_PREVIEW_PROJECT_REF"
[ -z "$MISSING" ] || die "Missing in $SECRETS:$MISSING" \
  "Both Supabase projects are required: without the preview one (pbgo-preview), the production keys would end up in" \
  "$ENV_FILE and in the Vercel preview and development targets."
[ "$PREVIEW_REF" != "$PROD_REF" ] || die "SUPABASE_PREVIEW_PROJECT_REF is the production project ($PROD_REF)" \
  "The preview project must be another one (pbgo-preview): $ENV_FILE and the Vercel preview and development targets get its keys."
if [ "$CHECK" = 1 ]; then ok "Production $PROD_REF, preview $PREVIEW_REF"; exit 0; fi
SBAPI="https://api.supabase.com/v1"
SB() { curl -s -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" "$@"; }
# sbq <ref> < <sql>: runs the SQL read from stdin, prints the JSON answer; HTTP status in $SBCODE
sbq() {
  node -e 'let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => console.log(JSON.stringify({ query: d })))' > "$TMP/query.json"
  SBCODE="$(SB -o "$TMP/answer.json" -w '%{http_code}' -X POST "$SBAPI/projects/$1/database/query" --data-binary @"$TMP/query.json")"
  cat "$TMP/answer.json"
}

# supabase_project <ref> <file> <label>: checks that the project is usable, then writes its URL and API keys into <file>
# (publishable and secret keys, else the legacy anon and service_role ones). <file> exists only when the project is
# usable; else the reason is printed and the status is 1: project unreachable or not healthy, keys not readable, tables
# not readable or not applied (supabase/migrations are applied on an empty project), or `public.games` without a `game`
# column, the schema of one project per game, which the shared schema can't be applied on
supabase_project() {
  local ref="$1" file="$2" tag="$3 ($1)" st pub sec state f
  rm -f "$file"
  st="$(SB "$SBAPI/projects/$ref" | json "o.status")"
  [ -n "$st" ] || { err "$tag: not reachable with SUPABASE_ACCESS_TOKEN (other account? removed?)"; return 1; }
  if [ "$st" != "ACTIVE_HEALTHY" ]; then
    printf "  %s is %s, waiting" "$tag" "$st"
    for _ in $(seq 1 60); do sleep 5; st="$(SB "$SBAPI/projects/$ref" | json "o.status")"; [ "$st" = "ACTIVE_HEALTHY" ] && break; printf "."; done; echo
    [ "$st" = "ACTIVE_HEALTHY" ] || { err "$tag: still $st, rerun later"; return 1; }
  fi
  SB "$SBAPI/projects/$ref/api-keys?reveal=true" > "$TMP/keys.json"
  pub="$(json "(o.find((k) => k.type === 'publishable') ?? o.find((k) => k.name === 'anon'))?.api_key" < "$TMP/keys.json")"
  sec="$(json "(o.find((k) => k.type === 'secret') ?? o.find((k) => k.name === 'service_role'))?.api_key" < "$TMP/keys.json")"
  rm -f "$TMP/keys.json"
  [ -n "$pub" ] && [ -n "$sec" ] || { err "$tag: API keys not readable"; return 1; }
  ok "$tag: API keys"
  state="$(sbq "$ref" <<< "select to_regclass('public.games') is not null as games, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'game') as game_column" \
    | json "o[0] ? (o[0].games ? (o[0].game_column ? 'ready' : 'legacy') : 'empty') : ''")"
  case "$state" in
    ready) ok "$tag: tables games, tasks and feedback present" ;;
    legacy)
      err "$tag: public.games has no game column: the schema of one project per game, before apps/web"
      echo "      supabase/migrations can't be applied on it: use an empty project, or migrate the tables by hand, then rerun"
      return 1 ;;
    empty)
      for f in supabase/migrations/*.sql; do
        sbq "$ref" < "$f" >/dev/null
        if [[ "$SBCODE" == 2* ]]; then ok "$tag: $(basename "$f") applied"
        else err "$tag: $(basename "$f"): $(json "o.message" < "$TMP/answer.json")"; return 1; fi
      done ;;
    *) err "$tag: tables not read: $(json "o.message" < "$TMP/answer.json")"; return 1 ;;
  esac
  envset "$file" NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co"
  envset "$file" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$pub"
  envset "$file" SUPABASE_SECRET_KEY "$sec"
}

echo "  Production: $PROD_REF  ·  preview and local: $PREVIEW_REF"
FAILED=0
# The production project matters for the Vercel production target only: --no-push doesn't read it
if [ "$PUSH" = 1 ]; then supabase_project "$PROD_REF" "$TMP/production.env" production || FAILED=1
else warn "--no-push: the production project is not read"; fi
supabase_project "$PREVIEW_REF" "$TMP/preview.env" preview || FAILED=1
[ "$FAILED" = 0 ] || die "A Supabase project can't be used (above): fix it, or point the secrets to another project, then rerun"

# ---------- apps/web/.env.local ----------
# Local development uses the preview project, never the production one
[ -f "$ENV_FILE" ] || cp apps/web/.env.example "$ENV_FILE"
chmod 600 "$ENV_FILE"
for k in "${SUPABASE_KEYS[@]}"; do envset "$ENV_FILE" "$k" "$(envget "$TMP/preview.env" "$k")"; done
ok "$ENV_FILE: Supabase of the preview project"

# ---------- Admin ----------
title "Admin (/<slug>/admin)"
LOGIN="$(setting ADMIN_LOGIN)"; LOGIN="${LOGIN:-admin}"
PASSWORD="$(setting ADMIN_PASSWORD)"; GENERATED=0
[ -z "$PASSWORD" ] && { PASSWORD="$(password)"; GENERATED=1; }
if safe "$LOGIN" && safe "$PASSWORD"; then
  envset "$ENV_FILE" ADMIN_LOGIN "$LOGIN"; envset "$ENV_FILE" ADMIN_PASSWORD "$PASSWORD"
  ok "ADMIN_LOGIN, ADMIN_PASSWORD$([ "$GENERATED" = 1 ] && echo " (password generated, in $ENV_FILE)")"
else err "ADMIN_LOGIN or ADMIN_PASSWORD holds characters a .env file can't keep unquoted (space, \$, quotes…)"; fi

# ---------- Vercel API of the admin (optional) ----------
title "Admin › Audience and Health (optional)"
for k in VERCEL_TOKEN VERCEL_TEAM_ID; do
  v="$(setting "$k")"
  if [ -z "$v" ]; then warn "$k not set"; elif safe "$v"; then envset "$ENV_FILE" "$k" "$v"; ok "$k"; else err "$k: unexpected characters"; fi
done

# ---------- Sanity write tokens ----------
title "Sanity write tokens"
STOKEN="$(sanity_token)"
while read -r slug pid; do
  key="$(token_name "$slug")"
  if ! is_project_id "$pid"; then warn "$slug: no Sanity project yet (pnpm go-live $slug)"
  elif [ -n "$(envget "$ENV_FILE" "$key")" ]; then ok "$key"
  elif [ -z "$STOKEN" ]; then warn "$key missing: npx sanity login, then rerun"
  elif sanity_write_token "$pid" "$ENV_FILE" "$key"; then ok "$key created (editor)"
  else err "$key not created (no access to the project $pid?)"; fi
done < <(registry 'GAMES.map((g) => `${g.slug} ${g.sanityProjectId}`)')
ok "Written: $ENV_FILE"

# ---------- Vercel project ----------
title "Vercel project \"$PROJECT\""
PUSHED=0
vercel_token() { for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
  [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token || "")' "$f" && return; done; }
if [ "$PUSH" = 0 ]; then warn "--no-push: nothing sent to Vercel"
else
  VTOKEN="$(vercel_token)"; [ -z "$VTOKEN" ] && VTOKEN="$(setting VERCEL_TOKEN)"
  TEAM="$(setting VERCEL_TEAM_ID)"; TEAM="${TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
  V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }
  VID=""; [ -n "$VTOKEN" ] && VID="$(V "https://api.vercel.com/v9/projects/$PROJECT?teamId=$TEAM" | json "o.id")"
  if [ -z "$VTOKEN" ]; then warn "Not logged in to Vercel (npx vercel login) and no VERCEL_TOKEN: nothing sent"
  elif [ -z "$VID" ]; then warn "No project \"$PROJECT\" in the team $TEAM: create it (root directory apps/web), then rerun"
  else
    # push <KEY> <value> <targets, JSON>: NEXT_PUBLIC_* in plain text (they ship to the browser), the rest encrypted
    push() {
      local type=encrypted res e; [[ "$1" == NEXT_PUBLIC_* ]] && type=plain
      K="$1" VAL="$2" T="$type" TARGETS="$3" node -e 'const { K, VAL, T, TARGETS } = process.env
        console.log(JSON.stringify({ key: K, value: VAL, type: T, target: JSON.parse(TARGETS) }))' > "$TMP/env.json"
      res="$(V -X POST "https://api.vercel.com/v10/projects/$VID/env?upsert=true&teamId=$TEAM" --data-binary @"$TMP/env.json")"
      rm -f "$TMP/env.json"
      e="$(echo "$res" | json "o.error?.message ?? o.failed?.[0]?.error?.message")"
      if [ -n "$e" ]; then err "$1 ($3): $e"; else ok "$1 → $(echo "$3" | tr -d '[]"' | tr , ' ')"; fi
    }
    push_supabase() { local k v; for k in "${SUPABASE_KEYS[@]}"; do v="$(envget "$1" "$k")"; [ -n "$v" ] && push "$k" "$v" "$2"; done; }
    ALL='["production","preview","development"]'
    # Supabase: the production project's keys to the production target only, the preview project's to preview and development
    push_supabase "$TMP/production.env" '["production"]'; push_supabase "$TMP/preview.env" '["preview","development"]'
    # The rest, the same everywhere (not NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SANITY_DATASET nor DEBUG_GAMES: local settings)
    while read -r k; do
      v="$(envget "$ENV_FILE" "$k")"; [ -n "$v" ] && push "$k" "$v" "$ALL"
    done < <(printf "%s\n" ADMIN_LOGIN ADMIN_PASSWORD VERCEL_TOKEN VERCEL_TEAM_ID; registry 'GAMES.map((g) => g.slug)' | while read -r s; do token_name "$s"; echo; done)
    [ -z "$(envget "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID)" ] && envset "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID "$VID"
    PUSHED=1
  fi
fi

title "Done"
echo "  Local:   $ENV_FILE (never committed) · pnpm dev → http://localhost:3100"
[ "$GENERATED" = 1 ] && echo "  Admin:   password generated, ADMIN_PASSWORD in $ENV_FILE (copy it to $SECRETS to keep it)"
[ "$PUSHED" = 1 ] && echo "  Vercel:  variables set, they apply from the next deployment of \"$PROJECT\""
exit 0

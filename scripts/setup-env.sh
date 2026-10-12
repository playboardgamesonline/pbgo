#!/usr/bin/env bash
# pnpm setup-env [--no-push | --check]
# Environment of apps/web (hub + every game): fills apps/web/.env.local, then pushes the variables to the Vercel
# project "pbgo", found by its id (below). Rerunnable; secret values are never printed. Reads
# ~/.config/pbgo/secrets.env (or $PBGO_SECRETS; outside the repo, chmod 600):
#   ADMIN_LOGIN, ADMIN_PASSWORD     the gamemaster account (/gamemaster), one for every game; a password is generated
#                                   when there is none
#   ADMIN_SESSION_SECRET            signs the gamemaster session cookie, 32 characters at least; generated when there is
#                                   none (a new one signs everyone out)
#   SUPABASE_ACCESS_TOKEN           Supabase personal token: API keys read, tables created on an empty project
#   SUPABASE_PROJECT_REF            production project, shared by every game (rows carry a `game` column)
#   SUPABASE_PREVIEW_PROJECT_REF    preview project (pbgo-preview), another project than the production one
#   VERCEL_TOKEN, VERCEL_TEAM_ID    optional: gamemaster › Audience and Health. A VERCEL_TOKEN here (else the one in
#                                   .env.local) is also the token this script uses on the Vercel API, ahead of the
#                                   Vercel CLI login, which is only the fallback
#   VERCEL_PROJECT_ID               optional: the id of the Vercel project the variables go to (prj_…); default
#                                   prj_bsk7OjC3wkJrI6ElHFa8bfD71xfs, the project "pbgo". The project is looked up by this
#                                   id, never by its name (a name can change, an id can't), through the API alone: no
#                                   .vercel/project.json and no Vercel CLI, so it works from any worktree
# The three Supabase values are required. The production keys go to the Vercel production target only: .env.local and
# the Vercel preview/development targets get the preview project's keys, never production ones. The script exits with
# code 1, before writing .env.local or sending anything, when a value is missing or a project can't be used
# (unreachable, keys unreadable, tables not applied, or still the schema of one project per game: `public.games`
# without a `game` column).
# The Supabase ↔ Vercel integration manages NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
# SUPABASE_SECRET_KEY on the production target: when one already exists there it is left as it is, printed as
# "– skipped (managed by Supabase integration)", which is neither a failure nor a reason to exit with an error. Past the
# checks above, the exit code is 1 only when the Vercel project can't be reached or a Vercel call really failed (✗),
# else 0.
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
# The Vercel project "pbgo", by its id: a rename doesn't change it (VERCEL_PROJECT_ID of the secrets file wins)
DEFAULT_VERCEL_PROJECT_ID="prj_bsk7OjC3wkJrI6ElHFa8bfD71xfs"
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

# ---------- Gamemaster ----------
title "Gamemaster (/gamemaster)"
LOGIN="$(setting ADMIN_LOGIN)"; LOGIN="${LOGIN:-admin}"
PASSWORD="$(setting ADMIN_PASSWORD)"; GENERATED=0
[ -z "$PASSWORD" ] && { PASSWORD="$(password)"; GENERATED=1; }
if safe "$LOGIN" && safe "$PASSWORD"; then
  envset "$ENV_FILE" ADMIN_LOGIN "$LOGIN"; envset "$ENV_FILE" ADMIN_PASSWORD "$PASSWORD"
  ok "ADMIN_LOGIN, ADMIN_PASSWORD$([ "$GENERATED" = 1 ] && echo " (password generated, in $ENV_FILE)")"
else err "ADMIN_LOGIN or ADMIN_PASSWORD holds characters a .env file can't keep unquoted (space, \$, quotes…)"; fi
# The key of the session cookie: generated once, then kept (the secrets file's value, else the one in .env.local)
SESSION_SECRET="$(setting ADMIN_SESSION_SECRET)"; SECRET_GENERATED=0
[ -z "$SESSION_SECRET" ] && { SESSION_SECRET="$(session_secret)"; SECRET_GENERATED=1; }
if safe "$SESSION_SECRET" && [ "${#SESSION_SECRET}" -ge 32 ]; then
  envset "$ENV_FILE" ADMIN_SESSION_SECRET "$SESSION_SECRET"
  ok "ADMIN_SESSION_SECRET$([ "$SECRET_GENERATED" = 1 ] && echo " (generated, in $ENV_FILE)")"
else err "ADMIN_SESSION_SECRET needs 32 characters at least and no space, \$ or quotes (openssl rand -base64 48 makes one)"; fi

# ---------- Vercel API of the gamemaster (optional) ----------
title "Gamemaster › Audience and Health (optional)"
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
title "Vercel project"
PUSHED=0; SKIPPED=0; VERCEL_FAILURES=0; VNAME=""
vercel_token() { for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do
  [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token || "")' "$f" && return; done; }
if [ "$PUSH" = 0 ]; then warn "--no-push: nothing sent to Vercel"
else
  # VERCEL_TOKEN (the secrets file's, else .env.local's) wins over the Vercel CLI login, which is only the fallback
  VTOKEN="$(setting VERCEL_TOKEN)"; VSOURCE="VERCEL_TOKEN"
  [ -z "$VTOKEN" ] && { VTOKEN="$(vercel_token)"; VSOURCE="Vercel CLI login"; }
  TEAM="$(setting VERCEL_TEAM_ID)"; TEAM="${TEAM:-team_5AgMIBlJbSmZXWxmJ1pDPHQi}"
  # The project is looked up by its id and never by its name, through the API alone: no .vercel/project.json, no Vercel
  # CLI, so any worktree will do. The id comes from the secrets file only (not .env.local, where `vercel env pull`
  # may have left the id of another project)
  PROJECT_ID="$(secret VERCEL_PROJECT_ID)"; PROJECT_ID="${PROJECT_ID:-$DEFAULT_VERCEL_PROJECT_ID}"
  V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }
  VID=""
  if [[ ! "$PROJECT_ID" =~ ^prj_[A-Za-z0-9]+$ ]]; then
    # Not printed: a value that is not an id may well be a token pasted on the wrong line
    err "VERCEL_PROJECT_ID in $SECRETS is not a project id (prj_…): the project is looked up by its id, never by its name"
    VERCEL_FAILURES=$((VERCEL_FAILURES + 1))
  elif [ -z "$VTOKEN" ]; then warn "No VERCEL_TOKEN (secrets file or .env.local) and no Vercel CLI login (npx vercel login): nothing sent"
  else
    ok "Vercel API token: $VSOURCE"
    VPROJECT="$(V "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM")"
    VERR="$(echo "$VPROJECT" | json "o.error ? o.error.message : ''")"
    VID="$(echo "$VPROJECT" | json "o.id")"; VNAME="$(echo "$VPROJECT" | json "o.name")"
    # Not found, token refused, team not allowed, no answer… the variables can't go anywhere: a failure. Asking the API
    # for an id can only answer with that id, so another one means the answer isn't the project's
    if [ -n "$VERR" ] || [ "$VID" != "$PROJECT_ID" ]; then
      err "Vercel project $PROJECT_ID (team $TEAM): ${VERR:-no project in the answer of the Vercel API}"
      echo "      Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID in $SECRETS, and that the token ($VSOURCE) reaches that team."
      VID=""; VERCEL_FAILURES=$((VERCEL_FAILURES + 1))
    else ok "Project ${VNAME:-$VID} ($VID)"; fi
  fi
  if [ -n "$VID" ]; then
    # The variables the project already has on the production target, as |KEY|KEY|… ("" when the list can't be read)
    PRODUCTION_KEYS="$(V "https://api.vercel.com/v10/projects/$VID/env?teamId=$TEAM" \
      | json "Array.isArray(o.envs) ? '|' + o.envs.filter((e) => [].concat(e.target ?? []).includes('production')).map((e) => e.key).join('|') + '|' : ''")"
    [ -n "$PRODUCTION_KEYS" ] || warn "The variables of the project can't be listed: the Supabase ones are pushed to production as they are"
    # push <KEY> <value> <targets, JSON>: NEXT_PUBLIC_* in plain text (they ship to the browser), the rest encrypted
    push() {
      local type=encrypted res e; [[ "$1" == NEXT_PUBLIC_* ]] && type=plain
      K="$1" VAL="$2" T="$type" TARGETS="$3" node -e 'const { K, VAL, T, TARGETS } = process.env
        console.log(JSON.stringify({ key: K, value: VAL, type: T, target: JSON.parse(TARGETS) }))' > "$TMP/env.json"
      res="$(V -X POST "https://api.vercel.com/v10/projects/$VID/env?upsert=true&teamId=$TEAM" --data-binary @"$TMP/env.json")"
      rm -f "$TMP/env.json"
      e="$(echo "$res" | json "o.error?.message ?? o.failed?.[0]?.error?.message")"
      if [ -n "$e" ]; then err "$1 ($3): $e"; VERCEL_FAILURES=$((VERCEL_FAILURES + 1))
      else ok "$1 → $(echo "$3" | tr -d '[]"' | tr , ' ')"; fi
    }
    # push_supabase <env file> <targets, JSON>: the three Supabase variables of the file. On the production target, one
    # that already exists is the Supabase ↔ Vercel integration's: left as it is, never overwritten
    push_supabase() {
      local k v
      for k in "${SUPABASE_KEYS[@]}"; do
        v="$(envget "$1" "$k")"; [ -n "$v" ] || continue
        if [[ "$2" == *'"production"'* && "$PRODUCTION_KEYS" == *"|$k|"* ]]; then
          skip "$k → production" "managed by Supabase integration"; SKIPPED=$((SKIPPED + 1))
        else push "$k" "$v" "$2"; fi
      done
    }
    ALL='["production","preview","development"]'
    # Supabase: the production project's keys to the production target only, the preview project's to preview and development
    push_supabase "$TMP/production.env" '["production"]'; push_supabase "$TMP/preview.env" '["preview","development"]'
    # The rest, the same everywhere (not NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SANITY_DATASET nor DEBUG_GAMES: local settings)
    while read -r k; do
      v="$(envget "$ENV_FILE" "$k")"; [ -n "$v" ] && push "$k" "$v" "$ALL"
    done < <(printf "%s\n" ADMIN_LOGIN ADMIN_PASSWORD ADMIN_SESSION_SECRET VERCEL_TOKEN VERCEL_TEAM_ID; registry 'GAMES.map((g) => g.slug)' | while read -r s; do token_name "$s"; echo; done)
    [ -z "$(envget "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID)" ] && envset "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID "$VID"
    PUSHED=1
  fi
fi

title "Done"
echo "  Local:   $ENV_FILE (never committed) · pnpm dev → http://localhost:3100"
[ "$GENERATED" = 1 ] && echo "  Account: password generated, ADMIN_PASSWORD in $ENV_FILE (copy it to $SECRETS to keep it)"
[ "$SECRET_GENERATED" = 1 ] && echo "  Session: ADMIN_SESSION_SECRET generated in $ENV_FILE (copy it to $SECRETS to keep it, a new one signs everyone out)"
if [ "$PUSHED" = 1 ]; then
  SKIPPED_NOTE=""; [ "$SKIPPED" -gt 0 ] && SKIPPED_NOTE=" ($SKIPPED left as they are: managed by the Supabase integration)"
  if [ "$VERCEL_FAILURES" = 0 ]; then echo "  Vercel:  variables set$SKIPPED_NOTE, they apply from the next deployment of \"${VNAME:-$VID}\""
  else echo "  Vercel:  the other variables are set$SKIPPED_NOTE, they apply from the next deployment of \"${VNAME:-$VID}\""; fi
fi
if [ "$VERCEL_FAILURES" != 0 ]; then echo "  Vercel:  $VERCEL_FAILURES step(s) failed (✗ above), fix them and rerun"; exit 1; fi
exit 0

#!/usr/bin/env bash
# pnpm setup-env [--no-push | --check]
# Environment of apps/web (hub + every game): applies the pending Supabase migrations (preview first, then production),
# fills apps/web/.env.local, then pushes the variables to the Vercel project "pbgo", found by its id (below). Rerunnable;
# secret values are never printed. Reads ~/.config/pbgo/secrets.env (or $PBGO_SECRETS; outside the repo, chmod 600):
#   ADMIN_LOGIN, ADMIN_PASSWORD     the gamemaster account (/gamemaster), one for every game; a password is generated
#                                   when there is none
#   ADMIN_SESSION_SECRET            signs the gamemaster session cookie, 32 characters at least. When this file has none,
#                                   the one of .env.local is kept, else a new one is generated, and it is appended here:
#                                   a value already in this file is never overwritten (a new secret signs everyone out)
#   SUPABASE_ACCESS_TOKEN           Supabase personal token: API keys read, migrations applied
#   SUPABASE_PROJECT_REF            production project, shared by every game (rows carry a `game` column)
#   SUPABASE_PREVIEW_PROJECT_REF    preview project (pbgo-preview), another project than the production one
#   VERCEL_TOKEN, VERCEL_TEAM_ID    the Vercel API: the project lookup, its variables, gamemaster › Audience and Health
#                                   (.env.local is the fallback for both). Without a VERCEL_TOKEN, Vercel is neither read
#                                   nor written. With one, VERCEL_TEAM_ID is required: there is no default team. The Vercel
#                                   CLI login is not used
#   VERCEL_PROJECT_ID               optional: the id of the Vercel project the variables go to (prj_…); default
#                                   prj_bsk7OjC3wkJrI6ElHFa8bfD71xfs, the project "pbgo". The project is looked up by this
#                                   id, never by its name (a name can change, an id can't), through the API alone: no
#                                   .vercel/project.json and no Vercel CLI, so it works from any worktree
#   NEXT_PUBLIC_POSTHOG_KEY         optional, both or neither with NEXT_PUBLIC_POSTHOG_HOST: the public key of the PostHog
#   NEXT_PUBLIC_POSTHOG_HOST        project (phc_…) and its ingest host (https://eu.i.posthog.com, no trailing slash).
#                                   Written to .env.local and pushed to every Vercel target. Without them the analytics and
#                                   the cookie banner are off; a pair of the wrong shape (the one @pbgo/analytics refuses)
#                                   is neither written nor pushed
#   NOTION_API_KEY                  optional: the secret (ntn_…) of the read-only Notion integration that reads the Games and
#                                   Editors databases, to list the games that are not live yet on the hub (packages/catalog).
#                                   Written to .env.local and pushed to every Vercel target. Without it the hub lists the live
#                                   games alone; a value of another shape is neither written nor pushed. Only its shape is
#                                   checked, nothing is sent to Notion: `pnpm catalog:list` shows what the key reads
#   SANITY_API_WRITE_TOKEN_<SLUG>   optional, one per game: a token found here is reused, see Sanity below
# The three Supabase values are required. The production keys go to the Vercel production target only: .env.local and
# the Vercel preview/development targets get the preview project's keys, never production ones. The script exits with
# code 1, before writing .env.local, appending to the secrets file or sending anything, when a value is missing (with a
# VERCEL_TOKEN: VERCEL_TEAM_ID too), a project can't be used (unreachable, keys unreadable, or still the schema of one
# project per game: `public.games` without a `game` column) or a migration fails.
# Migrations: supabase/migrations/*.sql, in file order, each one recorded in supabase_migrations.schema_migrations (the
# Supabase CLI's table: version = the number before the first "_", name = the rest). A recorded migration is never run
# again. A migration and its tracking row are one BEGIN … COMMIT: when it fails, neither stays, the run stops there (the
# ones before it stay applied) and the production project is not touched when the preview one fails. The preview project
# predates the tracking table: 0001 and 0002, whose effects are all there, are recorded without being run (baseline);
# any other migration runs. A migration can't hold its own BEGIN/COMMIT/ROLLBACK, nor a statement that can't run in a
# transaction (CREATE INDEX CONCURRENTLY, VACUUM…): apply those by hand and insert their row.
# The Supabase ↔ Vercel integration manages NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
# SUPABASE_SECRET_KEY on the production target: when one already exists there it is left as it is, printed as
# "– skipped (managed by Supabase integration)", which is neither a failure nor a reason to exit with an error. Past the
# checks above, the exit code is 1 only when the Vercel project can't be reached or a Vercel call really failed (✗), else 0.
#   --no-push   nothing is written to Vercel (the project is still read, for the Sanity write tokens it holds), and the
#               production Supabase project is neither read nor migrated
#   --check     only checks the settings (no network, nothing written); add-game.sh runs it first
# Sanity: a write token SANITY_API_WRITE_TOKEN_<SLUG> (editor) for each game of packages/games/src/registry.ts that has a
# project id. An existing one is reused: the secrets file's, else .env.local's, else the Vercel project's (read one
# variable at a time and written to .env.local only). A new one is created, with the `npx sanity login` session, only when
# none exists. A token that is missing is a warning (the game's admin is read-only), not a failure.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh
PUSH=1; CHECK=0
for a in "$@"; do case "$a" in --no-push) PUSH=0 ;; --check) CHECK=1 ;; *) echo "Usage: pnpm setup-env [--no-push | --check]"; exit 1 ;; esac; done
for t in node curl awk grep; do command -v "$t" >/dev/null || { echo "$t is missing"; exit 1; }; done
SECRETS="${PBGO_SECRETS:-$HOME/.config/pbgo/secrets.env}"
ENV_FILE="apps/web/.env.local"
# The Vercel project "pbgo", by its id: a rename doesn't change it (VERCEL_PROJECT_ID of the secrets file wins)
DEFAULT_VERCEL_PROJECT_ID="prj_bsk7OjC3wkJrI6ElHFa8bfD71xfs"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
SUPABASE_KEYS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY)
MIGRATIONS=(supabase/migrations/*.sql)
# <number>_<name>.sql: the number is the version of the tracking row, the name its name (both safe inside a SQL literal)
MIGRATION_RE='^([0-9]+)_([A-Za-z0-9_-]+)\.sql$'
# A line that opens or closes a transaction: a migration runs inside the BEGIN … COMMIT of setup-env, it can't hold its own
# (`end;` is not matched: it also closes every PL/pgSQL block)
OWN_TRANSACTION_RE='^[[:space:]]*(begin|start[[:space:]]+transaction|commit|rollback|abort)[^;]*;[[:space:]]*(--.*)?$'

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
# The Vercel API settings. Pushing needs them whole: a missing team (there is no default one) or a value that is not a project
# id stops the run here, before any migration; with --no-push they only turn the Vercel read into a warning
VTOKEN="$(setting VERCEL_TOKEN)"; TEAM="$(setting VERCEL_TEAM_ID)"
PROJECT_ID="$(secret VERCEL_PROJECT_ID)"; PROJECT_ID="${PROJECT_ID:-$DEFAULT_VERCEL_PROJECT_ID}"
VPROBLEM=""; VDETAIL=""
if [[ ! "$PROJECT_ID" =~ ^prj_[A-Za-z0-9]+$ ]]; then
  # The value is not printed: one that is not an id may well be a token pasted on the wrong line
  VPROBLEM="VERCEL_PROJECT_ID in $SECRETS is not a project id (prj_…)"
  VDETAIL="The project is looked up by its id, never by its name."
elif [ -n "$VTOKEN" ] && [ -z "$TEAM" ]; then
  VPROBLEM="VERCEL_TEAM_ID is not set (in $SECRETS or $ENV_FILE)"
  VDETAIL="The Vercel project is looked up in that team, there is no default: add VERCEL_TEAM_ID=team_… to $SECRETS (Vercel › Team Settings › General › Team ID)."
fi
[ "$PUSH" = 0 ] || [ -z "$VPROBLEM" ] || die "$VPROBLEM" "$VDETAIL"
if [ "$CHECK" = 1 ]; then ok "Production $PROD_REF, preview $PREVIEW_REF"; exit 0; fi
[ -f "${MIGRATIONS[0]}" ] || die "No migration in supabase/migrations"

SBAPI="https://api.supabase.com/v1"
SB() { curl -s -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" "$@"; }
# sbq <ref> < <sql>: runs the SQL read from stdin. Nothing is printed: the HTTP status is in $SBCODE and the JSON answer in
# $TMP/answer.json (emptied first, so a request that gets no answer doesn't leave the previous one behind)
sbq() {
  node -e 'let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => console.log(JSON.stringify({ query: d })))' > "$TMP/query.json"
  : > "$TMP/answer.json"
  SBCODE="$(SB -o "$TMP/answer.json" -w '%{http_code}' -X POST "$SBAPI/projects/$1/database/query" --data-binary @"$TMP/query.json")"
  rm -f "$TMP/query.json"
}
# answer <expression>: the expression evaluated on the JSON answer of the last sbq (`o`), "" on any error
answer() { json "$1" < "$TMP/answer.json"; }
# sb_error: why the last sbq failed: the first line of the message of the API, else the HTTP status
sb_error() {
  local m; m="$(answer "String(o.message ?? o.error ?? '').split('\n').map((l) => l.trim()).filter(Boolean)[0]?.slice(0, 300)")"
  printf "%s" "${m:-HTTP $SBCODE, no message}"
}

# read_schema <ref>: sets SCHEMA_STATE (empty: no public.games · legacy: public.games without a game column, the schema of
# one project per game · ready: the shared schema) and SCHEMA_TRACKING (1 when supabase_migrations.schema_migrations
# exists). Status 1 when the schema can't be read (sb_error says why)
read_schema() {
  sbq "$1" <<< "select to_regclass('public.games') is not null as games, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'game') as game_column, to_regclass('supabase_migrations.schema_migrations') is not null as tracking"
  SCHEMA_STATE="$(answer "o[0] ? (o[0].games ? (o[0].game_column ? 'ready' : 'legacy') : 'empty') : ''")"
  SCHEMA_TRACKING="$(answer "o[0]?.tracking ? 1 : 0")"
  [ -n "$SCHEMA_STATE" ]
}

# baseline_probe <version>: the SQL answering `ok` = true when the database already holds every effect of that migration;
# status 1 for a migration with no probe. Only 0001 and 0002 have one: they were applied by hand to the preview project,
# before there was a tracking table. This is not extended: any other migration is run, never assumed
baseline_probe() {
  case "$1" in
    0001)
      cat <<'SQL'
select coalesce(
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('games', 'tasks', 'feedback') and column_name = 'game') = 3
  and (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname in ('games', 'tasks', 'feedback') and relrowsecurity) = 3
  and (select count(*) from pg_indexes where schemaname = 'public' and indexname in ('games_game_created_at_idx', 'games_updated_at_idx', 'tasks_game_category_sort_order_idx', 'tasks_game_type_done_idx', 'feedback_game_status_created_at_idx', 'feedback_game_player_created_at_idx', 'feedback_ip_hash_created_at_idx')) = 7
  and (select not public and file_size_limit = 3145728 and allowed_mime_types = array['image/webp'] from storage.buckets where id = 'feedback'),
  false) as ok
SQL
      ;;
    0002)
      cat <<'SQL'
select coalesce(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games' and column_name = 'seen' and data_type = 'jsonb' and is_nullable = 'NO')
  and case when to_regprocedure('public.touch_game_player(text,text,text)') is not null then
    has_function_privilege('service_role', 'public.touch_game_player(text,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.touch_game_player(text,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.touch_game_player(text,text,text)', 'execute')
  end,
  false) as ok
SQL
      ;;
    *) return 1 ;;
  esac
}

# plan_migrations <label> <ref> <state> <tracking>: writes $TMP/plan-<label>.txt, one line per migration the project has no
# tracking row for: "apply|baseline <version> <name> <file>". baseline = the migration has a probe and the project already
# holds all its effects: it is recorded, not run. Read-only. Status 1, the reason printed, when a file name is not
# <number>_<name>.sql, when a number is recorded under another name (two migrations with the same number, or an applied one
# renamed: it would be skipped without a word) or when the tracking table can't be read
plan_migrations() {
  local label="$1" ref="$2" state="$3" tracking="$4" tag="$1 ($2)" plan="$TMP/plan-$1.txt" tracked="$TMP/tracked-$1.txt"
  local f base version name recorded action
  : > "$plan"; : > "$tracked"
  if [ "$tracking" = 1 ]; then
    sbq "$ref" <<< "select version, coalesce(name, '') as name from supabase_migrations.schema_migrations order by version"
    [[ "$SBCODE" == 2* ]] || { err "$tag: migrations table not read: $(sb_error)"; return 1; }
    answer "o.map((r) => r.version + ' ' + r.name).join('\n')" > "$tracked"
  fi
  for f in "${MIGRATIONS[@]}"; do
    base="${f##*/}"
    [[ "$base" =~ $MIGRATION_RE ]] || { err "$tag: $base is not a migration file name (<number>_<name>.sql)"; return 1; }
    version="${BASH_REMATCH[1]}"; name="${BASH_REMATCH[2]}"
    # Compared as strings: awk would take 0001 and 1 for the same number
    recorded="$(awk -v v="$version" '($1 "") == (v "") { print ($2 == "" ? "*" : $2); exit }' "$tracked")"
    if [ -z "$recorded" ]; then
      action=apply
      if [ "$state" = ready ] && baseline_probe "$version" > "$TMP/probe.sql"; then
        sbq "$ref" < "$TMP/probe.sql"
        [ "$(answer "o[0]?.ok")" = true ] && action=baseline
      fi
      echo "$action $version $name $f" >> "$plan"
    elif [ "$recorded" != "*" ] && [ "$recorded" != "$name" ]; then
      err "$tag: $base: version $version is already recorded as \"$recorded\" (two migrations with the same number, or an applied one renamed)"
      return 1
    fi
  done
}

# supabase_check <label> <ref> <file>: read-only. Checks that the project is usable, plans its migrations, then writes its URL
# and API keys into <file> (publishable and secret keys, else the legacy anon and service_role ones). <file> exists only
# when the project is usable; else the reason is printed and the status is 1: project unreachable or not healthy, keys or
# tables not readable, `public.games` without a `game` column (the schema of one project per game, which the shared
# schema can't be applied on), or migrations that can't be planned
supabase_check() {
  local label="$1" ref="$2" file="$3" tag="$1 ($2)" st pub sec
  rm -f "$file" "$TMP/plan-$label.txt"
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
  read_schema "$ref" || { err "$tag: tables not read: $(sb_error)"; return 1; }
  if [ "$SCHEMA_STATE" = legacy ]; then
    err "$tag: public.games has no game column: the schema of one project per game, before apps/web"
    echo "      supabase/migrations can't be applied on it: use an empty project, or migrate the tables by hand, then rerun"
    return 1
  fi
  plan_migrations "$label" "$ref" "$SCHEMA_STATE" "$SCHEMA_TRACKING" || return 1
  envset "$file" NEXT_PUBLIC_SUPABASE_URL "https://$ref.supabase.co"
  envset "$file" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$pub"
  envset "$file" SUPABASE_SECRET_KEY "$sec"
}

# supabase_migrate <label> <ref>: runs the plan of the project (supabase_check) and prints ONE line for it: up to date, or what
# was baselined and applied, or ✗ with the migration that failed and the error (status 1). Each migration goes in one request,
# BEGIN; its tracking row; the file; COMMIT. The row comes first so that a second run of setup-env at the same time waits
# on it, then fails on the key, instead of running the file twice. A failure rolls back the row with the file; the
# migrations after it are not run
supabase_migrate() {
  local label="$1" ref="$2" tag="$1 ($2)" plan="$TMP/plan-$1.txt" action version name path file applied="" baselined="" done_note="" note
  if [ ! -s "$plan" ]; then ok "$tag: up to date (${#MIGRATIONS[@]} migrations recorded)"; return 0; fi
  sbq "$ref" <<< "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text)"
  [[ "$SBCODE" == 2* ]] || { err "$tag: tracking table not created: $(sb_error)"; return 1; }
  while read -r action version name path <&3; do
    file="${path##*/}"
    {
      printf "begin;\ninsert into supabase_migrations.schema_migrations (version, name) values ('%s', '%s');\n" "$version" "$name"
      if [ "$action" = apply ]; then cat "$path"; printf "\n;\n"; fi
      printf "commit;\n"
    } > "$TMP/migration.sql"
    sbq "$ref" < "$TMP/migration.sql"
    if [[ "$SBCODE" != 2* ]]; then
      # The API closes its connection after each request: the aborted transaction goes with it, row and file included
      [ -z "$baselined$applied" ] || done_note=" (before it: ${baselined:+baselined $baselined}${baselined:+${applied:+; }}${applied:+applied $applied})"
      err "$tag: $file failed, not recorded: $(sb_error)$done_note"
      return 1
    fi
    if [ "$action" = apply ]; then applied="$applied${applied:+, }$file"; else baselined="$baselined${baselined:+, }$file"; fi
  done 3< "$plan"
  note=""
  [ -z "$baselined" ] || note="baselined $baselined (already in the schema, recorded without being run)"
  [ -z "$applied" ] || note="${note:+$note; }applied $applied"
  ok "$tag: $note"
}

echo "  Production: $PROD_REF  ·  preview and local: $PREVIEW_REF"
FAILED=0
# Preview first, so that a migration is tried there before production. The production project matters for the Vercel
# production target and its migrations only: --no-push doesn't read it
supabase_check preview "$PREVIEW_REF" "$TMP/preview.env" || FAILED=1
if [ "$PUSH" = 1 ]; then supabase_check production "$PROD_REF" "$TMP/production.env" || FAILED=1
else warn "--no-push: the production project is neither read nor migrated"; fi
[ "$FAILED" = 0 ] || die "A Supabase project can't be used (above): fix it, or point the secrets to another project, then rerun"

# ---------- Supabase migrations ----------
# Before the first one runs, in either project: a migration to be applied that holds its own BEGIN/COMMIT would commit early
# and leave its row and a part of its statements behind when it fails
cat "$TMP"/plan-*.txt 2>/dev/null | awk '$1 == "apply" { print $4 }' | sort -u > "$TMP/to-apply.txt"
FAILED=0
while read -r path; do
  if grep -Eiq "$OWN_TRANSACTION_RE" "$path"; then
    err "$path holds a BEGIN, COMMIT or ROLLBACK of its own: setup-env runs each migration in a transaction of its own, with its tracking row"
    FAILED=1
  fi
done < "$TMP/to-apply.txt"
[ "$FAILED" = 0 ] || die "A migration can't run in the transaction of setup-env (above)" \
  "Take the transaction statements out of it. A statement that can't run in a transaction (CREATE INDEX CONCURRENTLY, VACUUM…)" \
  "is applied by hand on each project, with its row inserted in supabase_migrations.schema_migrations."
title "Supabase migrations"
supabase_migrate preview "$PREVIEW_REF" || die "Migrations stopped on the preview project (above)" \
  "Fix the migration (or the project) and rerun. The production project has not been touched."
if [ "$PUSH" = 1 ]; then
  supabase_migrate production "$PROD_REF" || die "Migrations stopped on the production project (above)" \
    "The preview project is migrated. Fix the migration (or the project) and rerun."
fi

# ---------- apps/web/.env.local ----------
# Local development uses the preview project, never the production one
title "Local environment"
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
# The key of the session cookie: the secrets file's, else the one in .env.local, else generated. Kept in the secrets file
# (appended there, never overwritten) so that every run and every worktree signs with the same one: a different value
# pushed to Vercel would sign everyone out
SESSION_SECRET="$(setting ADMIN_SESSION_SECRET)"; SESSION_SOURCE=""; SESSION_NOTE=""
if [ -z "$SESSION_SECRET" ]; then SESSION_SECRET="$(session_secret)"; SESSION_SOURCE=" generated"
elif [ -z "$(secret ADMIN_SESSION_SECRET)" ]; then SESSION_SOURCE=" taken from $ENV_FILE"; fi
if safe "$SESSION_SECRET" && [ "${#SESSION_SECRET}" -ge 32 ]; then
  envset "$ENV_FILE" ADMIN_SESSION_SECRET "$SESSION_SECRET"
  if [ -z "$SESSION_SOURCE" ]; then ok "ADMIN_SESSION_SECRET"
  elif envadd "$SECRETS" ADMIN_SESSION_SECRET "$SESSION_SECRET"; then ok "ADMIN_SESSION_SECRET$SESSION_SOURCE, appended to $SECRETS"
  else
    warn "ADMIN_SESSION_SECRET$SESSION_SOURCE, but $SECRETS can't be written"
    SESSION_NOTE="copy ADMIN_SESSION_SECRET from $ENV_FILE to $SECRETS to keep it (a new one signs everyone out)"
  fi
else err "ADMIN_SESSION_SECRET needs 32 characters at least and no space, \$ or quotes (openssl rand -base64 48 makes one)"; fi

# ---------- Vercel API of the gamemaster (optional) ----------
title "Gamemaster › Audience and Health (optional)"
for k in VERCEL_TOKEN VERCEL_TEAM_ID; do
  v="$(setting "$k")"
  if [ -z "$v" ]; then warn "$k not set"; elif safe "$v"; then envset "$ENV_FILE" "$k" "$v"; ok "$k"; else err "$k: unexpected characters"; fi
done

# ---------- PostHog (optional) ----------
# Both values or neither (the key is public: it ships to the browser). The pair is checked with the app's own resolveConfig
# (packages/analytics/src/config.ts, imported by Node like the registry): one it refuses would deploy a site that reports
# nothing and shows no cookie banner, with no error anywhere. Values travel through the environment, never printed
posthog_valid() {
  POSTHOG_CONFIG="$ROOT/packages/analytics/src/config.ts" node --input-type=module -e "
    const { pathToFileURL } = await import('node:url')
    const { resolveConfig } = await import(pathToFileURL(process.env.POSTHOG_CONFIG).href)
    process.exit(resolveConfig({ key: process.env.PH_KEY, host: process.env.PH_HOST }) ? 0 : 1)" 2>/dev/null
}
title "PostHog analytics (optional)"
PH_KEY="$(setting NEXT_PUBLIC_POSTHOG_KEY)"; PH_HOST="$(setting NEXT_PUBLIC_POSTHOG_HOST)"; PH_OK=0
if [ -z "$PH_KEY" ] && [ -z "$PH_HOST" ]; then warn "NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST not set: analytics and the cookie banner stay off"
elif [ -z "$PH_KEY" ]; then warn "NEXT_PUBLIC_POSTHOG_KEY not set (the two go together): analytics and the cookie banner stay off"
elif [ -z "$PH_HOST" ]; then warn "NEXT_PUBLIC_POSTHOG_HOST not set (the two go together): analytics and the cookie banner stay off"
elif safe "$PH_KEY" && safe "$PH_HOST" && PH_KEY="$PH_KEY" PH_HOST="$PH_HOST" posthog_valid; then
  envset "$ENV_FILE" NEXT_PUBLIC_POSTHOG_KEY "$PH_KEY"; envset "$ENV_FILE" NEXT_PUBLIC_POSTHOG_HOST "$PH_HOST"
  PH_OK=1; ok "NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST"
else
  # No value in the message: a key pasted on the wrong line must not end up in a log
  err "NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST: a project key (phc_…) and an ingest host (https://eu.i.posthog.com, no trailing slash) are expected; neither is written nor pushed"
fi

# ---------- Notion catalog (optional) ----------
# The secret of a read-only Notion integration (packages/catalog): a server value, encrypted on Vercel. Only its shape is checked
# (Notion's two formats), setup-env sends nothing to Notion; `pnpm catalog:list` is what proves the key opens the databases
NOTION_KEY_RE='^(ntn|secret)_[A-Za-z0-9]+$'
title "Notion catalog (optional)"
NOTION_KEY="$(setting NOTION_API_KEY)"; NOTION_OK=0
if [ -z "$NOTION_KEY" ]; then warn "NOTION_API_KEY not set: the hub lists the live games alone"
elif safe "$NOTION_KEY" && [[ "$NOTION_KEY" =~ $NOTION_KEY_RE ]]; then
  envset "$ENV_FILE" NOTION_API_KEY "$NOTION_KEY"; NOTION_OK=1; ok "NOTION_API_KEY"
else
  # No value in the message, like PostHog's: a secret pasted on the wrong line must not end up in a log
  err "NOTION_API_KEY: the secret of a Notion integration (ntn_…) is expected; it is neither written nor pushed"
fi

# ---------- Vercel project ----------
# Looked up before the Sanity tokens: the project already holds them. The API alone is used, with the project's id: no
# .vercel/project.json, no Vercel CLI login, so any worktree will do. The project id comes from the secrets file only (not
# .env.local, where `vercel env pull` may have left the id of another project)
title "Vercel project"
PUSHED=0; SKIPPED=0; VERCEL_FAILURES=0; VID=""; VNAME=""; PRODUCTION_KEYS=""; FROM_VERCEL="|"
V() { curl -s -H "Authorization: Bearer $VTOKEN" -H "Content-Type: application/json" "$@"; }
# vfail <message> [detail…]: the Vercel project can't be used. A failure (✗, exit code 1) when the variables are to be pushed,
# else a warning: nothing is sent anyway, the project was only read
vfail() {
  local m="$1" l; shift
  if [ "$PUSH" = 1 ]; then err "$m"; VERCEL_FAILURES=$((VERCEL_FAILURES + 1)); else warn "$m"; fi
  for l in "$@"; do echo "      $l"; done
}
[ "$PUSH" = 1 ] || warn "--no-push: nothing is written to Vercel (the project is still read, for the Sanity write tokens it holds)"
if [ -n "$VPROBLEM" ]; then warn "$VPROBLEM (Vercel is not read)"
elif [ -z "$VTOKEN" ]; then warn "No VERCEL_TOKEN (secrets file or $ENV_FILE): Vercel is neither read nor written"
else
  V "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM" > "$TMP/vercel-project.json"
  VERR="$(json "o.error ? o.error.message : ''" < "$TMP/vercel-project.json")"
  VID="$(json "o.id" < "$TMP/vercel-project.json")"; VNAME="$(json "o.name" < "$TMP/vercel-project.json")"
  # Not found, token refused, team not allowed, no answer… the variables can't go anywhere. Asking the API for an id can only
  # answer with that id, so another one means the answer isn't the project's
  if [ -n "$VERR" ] || [ "$VID" != "$PROJECT_ID" ]; then
    vfail "Vercel project $PROJECT_ID (team $TEAM): ${VERR:-no project in the answer of the Vercel API}" \
      "Check VERCEL_PROJECT_ID and VERCEL_TEAM_ID in $SECRETS, and that VERCEL_TOKEN reaches that team."
    VID=""
  else
    ok "Project ${VNAME:-$VID} ($VID)"
    # The variables of the project (keys, ids, targets: a secret is only ciphertext in this list). On the production target,
    # as |KEY|KEY|… ("" when the list can't be read)
    V "https://api.vercel.com/v10/projects/$VID/env?teamId=$TEAM" > "$TMP/vercel-envs.json"
    PRODUCTION_KEYS="$(json "Array.isArray(o.envs) ? '|' + o.envs.filter((e) => [].concat(e.target ?? []).includes('production')).map((e) => e.key).join('|') + '|' : ''" < "$TMP/vercel-envs.json")"
    [ -n "$PRODUCTION_KEYS" ] || warn "The variables of the project can't be listed: no Sanity write token is reused from it, and the Supabase variables are pushed to production as they are"
  fi
fi

# vercel_secret <KEY>: the decrypted value of a variable of the Vercel project, "" when there is none (or it is a sensitive
# one, which Vercel never gives back, or it can't be read). It travels from the API into the caller's variable through
# pipes only: never printed, never in a file other than the .env.local the caller writes
vercel_secret() {
  local id
  [ -n "$VID" ] || return 0
  id="$(json "(o.envs ?? []).find((e) => e.key === '$1' && e.type !== 'sensitive')?.id" < "$TMP/vercel-envs.json")"
  [ -n "$id" ] || return 0
  V "https://api.vercel.com/v1/projects/$VID/env/$id?teamId=$TEAM" | json "o.decrypted === false ? '' : o.value"
}

# ---------- Sanity write tokens ----------
title "Sanity write tokens"
STOKEN="$(sanity_token)"
WHERE="$SECRETS and $ENV_FILE"; [ -z "$VID" ] || WHERE="$WHERE and the Vercel project"
while read -r slug pid; do
  key="$(token_name "$slug")"
  if ! is_project_id "$pid"; then warn "$slug: no Sanity project yet (pnpm go-live $slug)"; continue; fi
  # An existing token is reused: the secrets file's, else .env.local's, else the Vercel project's. A new one is created only
  # when none exists, and the lack of one is a warning: that game's admin is read-only
  val="$(setting "$key")"; from=""
  if [ -z "$val" ]; then
    val="$(vercel_secret "$key")"
    # Not the ciphertext of the list (it starts with eyJ), and the shape of a token
    if [ -n "$val" ] && [[ "$val" != eyJ* ]] && safe "$val" && [ "${#val}" -ge 20 ]; then from=" (reused from the Vercel project)"; FROM_VERCEL="$FROM_VERCEL$key|"
    else val=""; fi
  fi
  if [ -n "$val" ]; then envset "$ENV_FILE" "$key" "$val"; ok "$key$from"
  elif [ -z "$STOKEN" ]; then warn "$key missing, not in $WHERE: npx sanity login, then rerun to create it"
  elif sanity_write_token "$pid" "$ENV_FILE" "$key"; then ok "$key created (editor)"
  else warn "$key missing and not created (no access to the project $pid?)"; fi
done < <(registry 'GAMES.map((g) => `${g.slug} ${g.sanityProjectId}`)')
ok "Written: $ENV_FILE"

# ---------- Vercel variables ----------
if [ "$PUSH" = 1 ] && [ -n "$VID" ]; then
  title "Vercel variables"
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
  # The rest, the same everywhere (not NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SANITY_DATASET nor DEBUG_GAMES: local settings). A
  # Sanity token that came from the Vercel project is not sent back. PostHog and Notion only when their value passed the check
  # above (a refused one may still sit in .env.local): the browser value of PostHog is inlined at build, so it applies from the
  # next deployment
  while read -r k; do
    [[ "$FROM_VERCEL" == *"|$k|"* ]] && continue
    v="$(envget "$ENV_FILE" "$k")"; [ -n "$v" ] && push "$k" "$v" "$ALL"
  done < <(printf "%s\n" ADMIN_LOGIN ADMIN_PASSWORD ADMIN_SESSION_SECRET VERCEL_TOKEN VERCEL_TEAM_ID; [ "$PH_OK" = 1 ] && printf "%s\n" NEXT_PUBLIC_POSTHOG_KEY NEXT_PUBLIC_POSTHOG_HOST; [ "$NOTION_OK" = 1 ] && printf "%s\n" NOTION_API_KEY; registry 'GAMES.map((g) => g.slug)' | while read -r s; do token_name "$s"; echo; done)
  [ -z "$(envget "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID)" ] && envset "$ENV_FILE" VERCEL_ANALYTICS_PROJECT_ID "$VID"
  PUSHED=1
fi

title "Done"
echo "  Local:   $ENV_FILE (never committed) · pnpm dev → http://localhost:3100"
[ "$GENERATED" = 1 ] && echo "  Account: password generated, ADMIN_PASSWORD in $ENV_FILE (copy it to $SECRETS to keep it)"
[ -z "$SESSION_NOTE" ] || echo "  Session: $SESSION_NOTE"
if [ "$PUSHED" = 1 ]; then
  SKIPPED_NOTE=""; [ "$SKIPPED" -gt 0 ] && SKIPPED_NOTE=" ($SKIPPED left as they are: managed by the Supabase integration)"
  if [ "$VERCEL_FAILURES" = 0 ]; then echo "  Vercel:  variables set$SKIPPED_NOTE, they apply from the next deployment of \"${VNAME:-$VID}\""
  else echo "  Vercel:  the other variables are set$SKIPPED_NOTE, they apply from the next deployment of \"${VNAME:-$VID}\""; fi
fi
if [ "$VERCEL_FAILURES" != 0 ]; then echo "  Vercel:  $VERCEL_FAILURES step(s) failed (✗ above), fix them and rerun"; exit 1; fi
exit 0

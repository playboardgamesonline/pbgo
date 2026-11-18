#!/usr/bin/env bash
# pnpm go-live <slug> [--new-project]   e.g. pnpm go-live the-crew
# Sanity side of a game registered in packages/games (apps/web serves every game: no Vercel project, domain or
# database per game). Its Sanity project (the registry's projectId, else found by name or created), public dataset,
# CORS, studio .env, project id written in the registry and the studio, write token SANITY_API_WRITE_TOKEN_<SLUG> in
# apps/web/.env.local, studio deployed to <host>.sanity.studio. Rerunnable: every step already done is skipped.
# An id in the registry is no proof of a project: the games that came from the old standalone repositories hold ids that
# are not projects of this login. The Sanity API is asked first, and the run stops, creating nothing, on an id it does not
# find. --new-project is for such an id only: it makes the project anew and writes the new id over the old one (the registry,
# the Studio, content/config.ts). A write token already in apps/web/.env.local is tried against the project, and replaced by
# a new one when the project does not take it.
# Then: pnpm setup-env (pushes the token to Vercel); live and indexable stay false until set in the registry.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh
USAGE="Usage: pnpm go-live <slug> [--new-project]   (games/<slug>/apps/studio must exist)"
SLUG=""; NEW_PROJECT=0
for a in "$@"; do
  case "$a" in
    --new-project) NEW_PROJECT=1 ;;
    -*) echo "$USAGE"; exit 1 ;;
    *) [ -z "$SLUG" ] || { echo "$USAGE"; exit 1; }; SLUG="$a" ;;
  esac
done
DIR="games/$SLUG"; STUDIO="$DIR/apps/studio"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ -d "$STUDIO" ] || { echo "$USAGE"; exit 1; }
for t in node pnpm curl; do command -v "$t" >/dev/null || { echo "$t is missing"; exit 1; }; done
export SLUG
[ -n "$(registry 'GAMES.find((g) => g.slug === process.env.SLUG)?.slug')" ] \
  || { echo "\"$SLUG\" is not in packages/games/src/registry.ts (pnpm new-game registers it)"; exit 1; }
SITE="https://playboardgamesonline.app"
ENV_FILE="apps/web/.env.local"
TOKEN_KEY="$(token_name "$SLUG")"
echo "Game: $SLUG  ·  $SITE/$SLUG"

# ---------- Sanity project ----------
title "Sanity"
STOKEN="$(sanity_token)"; [ -z "$STOKEN" ] && { npx -y sanity@latest login; STOKEN="$(sanity_token)"; }
[ -n "$STOKEN" ] || { err "no Sanity login (npx sanity login)"; exit 1; }
OLD_PID="$(registry 'GAMES.find((g) => g.slug === process.env.SLUG).sanityProjectId')"
PID="$OLD_PID"; FROM="the registry"
is_project_id "$PID" || { PID="$(cat "$DIR/.sanity-project-id" 2>/dev/null)"; FROM="$DIR/.sanity-project-id"; }
if is_project_id "$PID"; then
  # An id of the right shape is not a project: the API is asked, under this login, before anything is made with it
  case "$(sanity_project_status "$PID")" in
    200)
      [ "$NEW_PROJECT" = 0 ] || { err "Sanity project $PID exists under this login: --new-project is for an id whose project is gone, nothing was changed"; exit 1; }
      ok "Sanity project: $PID" ;;
    404|403)
      if [ "$NEW_PROJECT" = 1 ]; then
        warn "Sanity project $PID ($FROM) is not one of this login's projects: a new one is made for $SLUG"; PID=""
      else
        err "Sanity project $PID ($FROM) is not one of this login's projects: the id came with the game's old repository, or the project was deleted. Nothing was made."
        echo "      Its Studio and its seed cannot work with it. To make a new project (public dataset, CORS, write token, Studio: all of it outside the repo)"
        echo "      and write its id over the old one in the registry, the Studio and content/config.ts: pnpm go-live $SLUG --new-project"
        exit 1
      fi ;;
    401) err "the Sanity login is no longer good (npx sanity login), then rerun: nothing was made"; exit 1 ;;
    *) err "Sanity did not answer about the project $PID (network?): nothing was made, rerun"; exit 1 ;;
  esac
fi
if ! is_project_id "$PID"; then
  PID="$(S "$SANITY_API/projects" | json "o.find((p) => p.displayName === '$SLUG')?.id")"
  if [ -n "$PID" ]; then ok "Sanity project found: $SLUG ($PID)"
  else
    ORG_ID="$(S "$SANITY_API/organizations" | json "o.find((x) => [x.name, x.slug].some((n) => (n || '').toLowerCase() === 'main'))?.id")"
    [ -z "$ORG_ID" ] && ORG_ID="$(S "$SANITY_API/projects/2lo2f5sv" | json "o.organizationId")"
    RES="$(S -X POST "$SANITY_API/projects" -d "{\"displayName\":\"$SLUG\",\"organizationId\":\"$ORG_ID\"}")"
    PID="$(echo "$RES" | json "o.id")"
    is_project_id "$PID" || { err "Sanity project not created (5 new projects per hour at most): $(echo "$RES" | json "o.message ?? o.error")"; exit 1; }
    ok "Sanity project created: $SLUG ($PID)"
  fi
fi
echo "$PID" > "$DIR/.sanity-project-id"
S -X PUT "$SANITY_API/projects/$PID/datasets/production" -d '{"aclMode":"public"}' >/dev/null
for origin in "$SITE" "http://localhost:3100"; do
  S -X POST "$SANITY_API/projects/$PID/cors" -d "{\"origin\":\"$origin\",\"allowCredentials\":false}" >/dev/null
done
ok "Dataset production (public), CORS for $SITE and http://localhost:3100"

# ---------- Project id and studio host in the code ----------
# Studio host: its .env, else the one written in sanity.cli.ts, else the slug (studio_host, lib.sh)
HOST="$(studio_host "$SLUG")"
envset "$STUDIO/.env" SANITY_STUDIO_PROJECT_ID "$PID"
envset "$STUDIO/.env" SANITY_STUDIO_DATASET production
envset "$STUDIO/.env" SANITY_STUDIO_HOST "$HOST"
PID="$PID" HOST="$HOST" OLD="$OLD_PID" node - "$DIR" "$SLUG" <<'JS' && ok "Project id in the registry and the studio, studio host: $HOST"
const fs = require("fs"), path = require("path")
const [dir, slug] = process.argv.slice(2), { PID, HOST, OLD } = process.env
const sub = (file, fn) => { if (fs.existsSync(file)) { const s = fs.readFileSync(file, "utf8"), t = fn(s); if (t !== s) fs.writeFileSync(file, t) } }
// The id of a project that is gone (--new-project) is written over wherever it stands as code; the placeholder of a new game is filled in
const old = /^[a-z0-9-]+$/.test(OLD) && OLD !== PID ? OLD : null
// Registry: only this game's entry, from its `slug:` line to the next one
sub("packages/games/src/registry.ts", (s) => {
  const lines = s.split("\n"), start = lines.findIndex((l) => l.trim() === `slug: "${slug}",`)
  if (start < 0) throw new Error(`${slug} not found in the registry`)
  for (let i = start + 1; i < lines.length && !/^\s*slug: /.test(lines[i]); i++)
    lines[i] = lines[i].replace(/sanityProjectId: "[^"]*"/, `sanityProjectId: "${PID}"`)
  return lines.join("\n")
})
for (const file of ["sanity.cli.ts", "sanity.config.ts", ".env.example"])
  sub(path.join(dir, "apps/studio", file), (s) => {
    const t = s.replaceAll("__SANITY_PROJECT_ID__", PID).replaceAll("__SANITY_STUDIO_HOST__", HOST)
    return old ? t.replaceAll(old, PID) : t
  })
// The seed's config, for a game that has content as code: it holds the id too (the game's data test checks that it is the registry's)
sub(path.join(dir, "content/config.ts"), (s) => (old ? s.replaceAll(old, PID) : s))
JS
if is_project_id "$OLD_PID" && [ "$OLD_PID" != "$PID" ]; then
  LEFT="$(grep -rl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.sanity --exclude-dir=dist -e "$OLD_PID" "$DIR" packages/games/src 2>/dev/null | head -5 | tr '\n' ' ')"
  [ -z "$LEFT" ] || warn "the old id $OLD_PID is still written in: ${LEFT}(notes, by hand)"
fi

# ---------- Write token of apps/web (admin saves) ----------
# A token already in .env.local is kept only when the project takes it: one made for another project (this game's project was made
# again) is no use, and the seed would answer "Unauthorized - Session not found". A project that does not answer leaves it as it is
KEEP=0; HAVE="$(envget "$ENV_FILE" "$TOKEN_KEY")"
if [ -n "$HAVE" ]; then
  case "$(sanity_token_status "$PID" "$HAVE")" in
    200) ok "$TOKEN_KEY already in $ENV_FILE, and the project takes it"; KEEP=1 ;;
    401) warn "$TOKEN_KEY in $ENV_FILE is not taken by the project $PID (the token of an older project?): a new one is made" ;;
    *) warn "$TOKEN_KEY in $ENV_FILE could not be tried against the project $PID (no answer): kept as it is"; KEEP=1 ;;
  esac
fi
if [ "$KEEP" = 1 ]; then :
elif sanity_write_token "$PID" "$ENV_FILE" "$TOKEN_KEY"; then ok "$TOKEN_KEY created (editor) in $ENV_FILE"
else err "write token not created: create an Editor token in sanity.io/manage → API → Tokens, as $TOKEN_KEY in $ENV_FILE"; fi

# ---------- Studio ----------
title "Studio"
pnpm install --silent >/dev/null 2>&1 || warn "pnpm install reported an error"
LOG="${TMPDIR:-/tmp}/pbgo-studio-$SLUG.log"
if (cd "$STUDIO" && SANITY_AUTH_TOKEN="$STOKEN" npx sanity deploy -y >"$LOG" 2>&1); then ok "Studio: https://$HOST.sanity.studio"
else err "studio not deployed, see $LOG (host taken? set another SANITY_STUDIO_HOST in $STUDIO/.env and rerun)"; fi

title "Next"
echo "  Local:   pnpm dev → http://localhost:3100/$SLUG (gamemaster: /gamemaster/$SLUG)"
echo "  Vercel:  pnpm setup-env pushes $TOKEN_KEY to the project \"pbgo\""
echo "  Commit:  packages/games/src/registry.ts and $STUDIO (project id), and $DIR/content/config.ts when the game has one, then push"
echo "  Launch:  live: true in packages/games/src/registry.ts when the game is ready, indexable: true for search engines"

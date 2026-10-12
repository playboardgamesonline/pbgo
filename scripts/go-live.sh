#!/usr/bin/env bash
# pnpm go-live <slug>   e.g. pnpm go-live the-crew
# Sanity side of a game registered in packages/games (apps/web serves every game: no Vercel project, domain or
# database per game). Its Sanity project (the registry's projectId, else found by name or created), public dataset,
# CORS, studio .env, project id written in the registry and the studio, write token SANITY_API_WRITE_TOKEN_<SLUG> in
# apps/web/.env.local, studio deployed to <host>.sanity.studio. Rerunnable: every step already done is skipped.
# Then: pnpm setup-env (pushes the token to Vercel); live and indexable stay false until set in the registry.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh
SLUG="${1:-}"; DIR="games/$SLUG"; STUDIO="$DIR/apps/studio"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ -d "$STUDIO" ] || { echo "Usage: pnpm go-live <slug>   (games/<slug>/apps/studio must exist)"; exit 1; }
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
PID="$(registry 'GAMES.find((g) => g.slug === process.env.SLUG).sanityProjectId')"
is_project_id "$PID" || PID="$(cat "$DIR/.sanity-project-id" 2>/dev/null)"
if is_project_id "$PID"; then
  ok "Sanity project: $PID"
else
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
# Studio host: its .env, else the one written in sanity.cli.ts, else the slug
HOST="$(envget "$STUDIO/.env" SANITY_STUDIO_HOST)"
[ -z "$HOST" ] && HOST="$(sed -nE 's/.*studioHost:[^"]*"([a-z0-9-]+)".*/\1/p' "$STUDIO/sanity.cli.ts" | head -1)"
[ -z "$HOST" ] && HOST="$SLUG"
envset "$STUDIO/.env" SANITY_STUDIO_PROJECT_ID "$PID"
envset "$STUDIO/.env" SANITY_STUDIO_DATASET production
envset "$STUDIO/.env" SANITY_STUDIO_HOST "$HOST"
PID="$PID" HOST="$HOST" node - "$DIR" "$SLUG" <<'JS' && ok "Project id in the registry and the studio, studio host: $HOST"
const fs = require("fs"), path = require("path")
const [dir, slug] = process.argv.slice(2), { PID, HOST } = process.env
const sub = (file, fn) => { if (fs.existsSync(file)) { const s = fs.readFileSync(file, "utf8"), t = fn(s); if (t !== s) fs.writeFileSync(file, t) } }
// Registry: only this game's entry, from its `slug:` line to the next one
sub("packages/games/src/registry.ts", (s) => {
  const lines = s.split("\n"), start = lines.findIndex((l) => l.trim() === `slug: "${slug}",`)
  if (start < 0) throw new Error(`${slug} not found in the registry`)
  for (let i = start + 1; i < lines.length && !/^\s*slug: /.test(lines[i]); i++)
    lines[i] = lines[i].replace('sanityProjectId: "__SANITY_PROJECT_ID__"', `sanityProjectId: "${PID}"`)
  return lines.join("\n")
})
for (const file of ["sanity.cli.ts", "sanity.config.ts", ".env.example"])
  sub(path.join(dir, "apps/studio", file), (s) => s.replaceAll("__SANITY_PROJECT_ID__", PID).replaceAll("__SANITY_STUDIO_HOST__", HOST))
JS

# ---------- Write token of apps/web (admin saves) ----------
if [ -n "$(envget "$ENV_FILE" "$TOKEN_KEY")" ]; then ok "$TOKEN_KEY already in $ENV_FILE"
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
echo "  Commit:  packages/games/src/registry.ts and $STUDIO (project id), then push"
echo "  Launch:  live: true in packages/games/src/registry.ts when the game is ready, indexable: true for search engines"

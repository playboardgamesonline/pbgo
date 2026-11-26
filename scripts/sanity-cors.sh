#!/usr/bin/env bash
# pnpm sanity:cors [--dry-run]
# Adds the browser origins the site needs to the CORS list of the Sanity project of every game of the registry: production,
# local development and the preview deployments of Vercel (https://*.vercel.app, as the platform's own project has it). The
# Sanity image CDN refuses a picture to a page whose origin is not in its project's list ("CORS Origin not allowed", 403), and
# a board paints its cards from those pictures with CORS, so a preview deployment shows a game with no art until it is there.
# No credentials are allowed for any origin: the datasets are public and read only. Rerunnable: an origin already in a list is
# left as it is. Needs the Sanity CLI login (npx sanity login) of the account that holds the projects.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh
DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    *) echo "Usage: pnpm sanity:cors [--dry-run]"; exit 1 ;;
  esac
done
for t in node curl; do command -v "$t" >/dev/null || { echo "$t is missing"; exit 1; }; done
STOKEN="$(sanity_token)"
[ -n "$STOKEN" ] || { err "no Sanity login (npx sanity login), then rerun"; exit 1; }

title "Sanity CORS"
FAILED=0
while IFS=" " read -r SLUG PID; do
  [ -n "$PID" ] && is_project_id "$PID" || { skip "$SLUG" "no Sanity project in the registry"; continue; }
  case "$(sanity_project_status "$PID")" in
    200) ;;
    401) err "the Sanity login is no longer good (npx sanity login), then rerun"; exit 1 ;;
    *) skip "$SLUG ($PID)" "not a project of this login"; continue ;;
  esac
  HAVE="$(S "$SANITY_API/projects/$PID/cors" | json "o.map((c) => c.origin).join(' ')")"
  for origin in $SANITY_SITE_ORIGINS; do
    if [[ " $HAVE " == *" $origin "* ]]; then ok "$SLUG ($PID): $origin already there"; continue; fi
    if [ "$DRY" = 1 ]; then warn "$SLUG ($PID): $origin would be added"; continue; fi
    CODE="$(S -o /dev/null -w '%{http_code}' -X POST "$SANITY_API/projects/$PID/cors" -d "{\"origin\":\"$origin\",\"allowCredentials\":false}")"
    if [ "$CODE" = 200 ] || [ "$CODE" = 201 ]; then ok "$SLUG ($PID): $origin added"; else err "$SLUG ($PID): $origin not added (HTTP $CODE)"; FAILED=1; fi
  done
done < <(registry 'GAMES.map((g) => `${g.slug} ${g.sanityProjectId ?? ""}`).join("\n")')
exit $FAILED

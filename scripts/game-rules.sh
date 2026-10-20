#!/usr/bin/env bash
# pnpm game-rules <slug> --rules [<lang>=]<file.pdf> …   e.g. pnpm game-rules the-crew --rules fr=regles.pdf --rules en=rules.pdf
# Puts a game's rules PDFs in the draft of its Sanity Settings (Studio › Identity & Mechanics › Mechanics tab, "Rules PDF (FR|EN|ES|DE)"):
# each file is uploaded to the game's dataset and referenced by its field. pnpm add-game does it for the rules given while the
# game is created; this is for a rulebook that comes later, or that is too big for the upload of the gamemaster (4.4 MB).
# Nothing is published (publishing stays in the Studio). A field that already holds a file keeps it unless --overwrite, and
# running it again with the same files changes nothing. --dry-run reads the dataset and says what would happen, writes nothing.
# Needs the game's write token (SANITY_API_WRITE_TOKEN_<SLUG> in the environment or apps/web/.env.local, pnpm go-live makes it).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# pnpm runs the script from the root of the repo; the relative paths of --rules are read from the folder the command was typed in
USER_CWD="${INIT_CWD:-$PWD}"
cd "$ROOT"
source scripts/lib.sh

usage() {
  cat <<'EOF'
Usage: pnpm game-rules <slug> --rules [<lang>=]<file.pdf> [--rules …] [options]
       e.g. pnpm game-rules the-crew --rules the-crew-rules.pdf --rules fr=regles.pdf
Options:
  --rules [<lang>=]<file>   a rulebook PDF, once per language (fr, en, es, de; no language = English)
  --dry-run                 read the dataset and say what would happen, write nothing
  --overwrite               replace a file a field already holds (without it the field keeps its file)
  --help, -h                this text
EOF
  exit "${1:-1}"
}

SLUG=""; DRY=0; OVERWRITE=0; RULES=()
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --dry-run) DRY=1 ;;
    --overwrite) OVERWRITE=1 ;;
    --rules|--rules=*)
      if [[ "$1" == *=* ]]; then VALUE="${1#*=}"
      elif [ $# -ge 2 ] && [[ "$2" != -* ]]; then VALUE="$2"; shift
      else VALUE=""; fi
      [ -n "$VALUE" ] || { echo "--rules needs a value"; usage; }
      RULES+=("$VALUE") ;;
    --) ;;
    -*) echo "Unknown option $1"; usage ;;
    *) [ -z "$SLUG" ] || { echo "One slug only, got \"$SLUG\" and \"$1\""; usage; }; SLUG="$1" ;;
  esac
  shift
done
[ -n "$SLUG" ] || usage
[ ${#RULES[@]} -gt 0 ] || { echo "No rulebook given: --rules [<lang>=]<file.pdf>"; usage; }

for t in node pnpm; do command -v "$t" >/dev/null || { err "$t is missing"; exit 1; }; done
export SLUG
if [ -z "$(registry 'GAMES.find((g) => g.slug === process.env.SLUG)?.slug')" ]; then
  err "\"$SLUG\" is not a game of packages/games/src/registry.ts. The games: $(registry 'GAMES.map((g) => g.slug)' | tr '\n' ' ' | sed 's/ *$//')"
  exit 1
fi
PID="$(registry 'GAMES.find((g) => g.slug === process.env.SLUG)?.sanityProjectId')"
is_project_id "$PID" || { err "$SLUG has no Sanity project yet: pnpm go-live $SLUG creates it"; exit 1; }

ARGS=(--slug "$SLUG" --project "$PID" --from "$USER_CWD")
for rule in "${RULES[@]}"; do ARGS+=(--rules "$rule"); done
if [ "$DRY" = 1 ]; then ARGS+=(--dry-run); else ARGS+=(--apply); fi
if [ "$OVERWRITE" = 1 ]; then ARGS+=(--overwrite); fi
rulebook place "${ARGS[@]}"

#!/usr/bin/env bash
# pnpm add-game                                  guided: asks for the name and the rules PDF, then does all of it
# pnpm add-game <slug> [options]                 e.g. pnpm add-game the-crew --name "The Crew" --rules the-crew.pdf
# pnpm add-game --name "<Game Name>" [options]   the slug comes from the name (The Crew → the-crew)
# A new game, from nothing to its Sanity Studio: new-game (games/<slug> from the template, registered in packages/games),
# go-live (Sanity project, public dataset, CORS, write token, Studio deployed), the rules PDFs into the draft of the game's
# Settings (the rulebook tool of @pbgo/content-kit), setup-env (pending Supabase migrations, apps/web/.env.local, variables
# pushed to Vercel), then the Studio opens. Sanity only gets drafts and the game is not live: nothing is published.
# Nothing is created when a check fails (setup-env --check, the name and the slug, the PDFs, --push's clean tree), and what
# leaves the machine (Sanity, Supabase, Vercel) is listed and confirmed first, unless --yes. --dry-run stops after that
# list, with every check done and nothing created: how a program that cannot answer the question shows it to the owner.
# --push: commits the new game and pushes the current branch (a new branch named after the game when on main), ready
# for a pull request. Env files, .sanity-project-id and .vercel stay out of the commit (git-ignored, checked again).
# Next, in Claude Code: /game-new <slug> proposes the categories and the fields of the game's Studio (skills game-new and
# game-sanity-create). A rulebook of any size is added later with pnpm game-rules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# pnpm runs the script from the root of the repo; the folder the command was typed in is INIT_CWD, and the relative paths of
# --rules and of the answers are read from there
USER_CWD="${INIT_CWD:-$PWD}"
cd "$ROOT"
source scripts/lib.sh

usage() {
  cat <<'EOF'
Usage: pnpm add-game                                  guided: asks the name and the rules PDF, then does all of it
       pnpm add-game <slug> [options]                 e.g. pnpm add-game the-crew --name "The Crew" --rules the-crew.pdf
       pnpm add-game --name "<Game Name>" [options]   the slug comes from the name (The Crew → the-crew)
Options:
  --name "<Game Name>"      what the hub, the Studio and the docs print (default: the slug, capitalised)
  --rules [<lang>=]<file>   a rulebook PDF, once per language (fr, en, es, de; no language = English)
  --yes, -y                 do not ask before creating anything
  --dry-run                 run every check, print what would be created and stop: nothing is created
  --no-open                 do not open the Studio at the end
  --push                    commit the new game and push a branch for a pull request (needs a clean working tree)
  --help, -h                this text
EOF
  exit "${1:-1}"
}

SLUG=""; NAME=""; PUSH=0; YES=0; DRY=0; OPEN=1; RULES=()
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --push) PUSH=1 ;;
    -y|--yes) YES=1 ;;
    --dry-run) DRY=1 ;;
    --no-open) OPEN=0 ;;
    --name|--rules|--name=*|--rules=*)
      FLAG="${1%%=*}"
      if [[ "$1" == *=* ]]; then VALUE="${1#*=}"
      elif [ $# -ge 2 ] && [[ "$2" != -* ]]; then VALUE="$2"; shift
      else VALUE=""; fi
      [ -n "$VALUE" ] || { echo "$FLAG needs a value"; usage; }
      if [ "$FLAG" = --name ]; then NAME="$VALUE"; else RULES+=("$VALUE"); fi ;;
    --) ;;
    -*) echo "Unknown option $1"; usage ;;
    *) [ -z "$SLUG" ] || { echo "One slug only, got \"$SLUG\" and \"$1\""; usage; }; SLUG="$1" ;;
  esac
  shift
done

# Questions are asked on a terminal only: a script run by another program gets the same game, with no prompt
INTERACTIVE=0
if [ -t 0 ] && [ -t 1 ]; then INTERACTIVE=1; fi
[ -n "$SLUG$NAME" ] || [ "$INTERACTIVE" = 1 ] || usage

# ask <prompt> [default]: one line from the keyboard into REPLY_TEXT, trimmed (Enter = the default); Ctrl-D cancels
ask() {
  local shown=""
  [ -z "${2:-}" ] || shown=" [$2]"
  read -e -r -p "$1$shown: " REPLY_TEXT || { echo; echo "Cancelled, nothing was created"; exit 1; }
  REPLY_TEXT="${REPLY_TEXT#"${REPLY_TEXT%%[![:space:]]*}"}"
  REPLY_TEXT="${REPLY_TEXT%"${REPLY_TEXT##*[![:space:]]}"}"
  [ -n "$REPLY_TEXT" ] || REPLY_TEXT="${2:-}"
}

# confirm <question>: Enter or yes goes on, anything else stops
confirm() {
  local answer
  read -e -r -p "$1 [Y/n] " answer || { echo; echo "Cancelled, nothing was created"; exit 1; }
  case "$answer" in
    ""|[Yy]|[Yy][Ee][Ss]|[Oo]|[Oo][Uu][Ii]) ;;
    *) echo "Cancelled, nothing was created"; exit 1 ;;
  esac
}

# open_url <url>: in the browser, when the machine has a way to
open_url() {
  if command -v open >/dev/null; then open "$1"
  elif command -v xdg-open >/dev/null; then xdg-open "$1" >/dev/null 2>&1
  else return 1; fi
}

# ---------- checks, before anything is asked or created ----------
for t in node pnpm curl; do command -v "$t" >/dev/null || { err "$t is missing"; exit 1; }; done
# setup-env runs near the end (it needs the Sanity project that go-live creates), so its prerequisites (Supabase values,
# Vercel team) are checked now
bash scripts/setup-env.sh --check
if [ "$PUSH" = 1 ] && [ -n "$(git status --porcelain)" ]; then
  err "--push needs a clean working tree (the commit holds the new game only): commit or stash first"; exit 1
fi

# ---------- guided: the name, the slug, the rules PDF of each language ----------
if [ -z "$SLUG$NAME" ]; then
  echo
  echo "A new game: its name, its rules, then the code, the Sanity project and its Studio. Nothing is created before the summary."
  echo
  while true; do
    ask "Name of the game (e.g. The Crew)"
    PROBLEM="$(name_problem "$REPLY_TEXT")"
    if [ -n "$PROBLEM" ]; then err "$PROBLEM"; continue; fi
    NAME="$(clean_name "$REPLY_TEXT")"; break
  done
  PROPOSED="$(slug_of_name "$NAME")"
  while true; do
    ask "Address of the game, its slug (playboardgamesonline.app/<slug>)" "$PROPOSED"
    PROBLEM="$(slug_problem "$REPLY_TEXT")"
    if [ -z "$PROBLEM" ] && [ -e "games/$REPLY_TEXT" ]; then PROBLEM="games/$REPLY_TEXT already exists"; fi
    if [ -n "$PROBLEM" ]; then err "$PROBLEM"; continue; fi
    SLUG="$REPLY_TEXT"; break
  done
  if [ ${#RULES[@]} -eq 0 ]; then
    echo
    echo "Rules: the PDF of each language, its path or the file dragged here. Enter skips a language, and none is fine:"
    echo "pnpm game-rules adds one later."
    # English first, the language every visitor falls back to, then the others as the site lists them
    ORDER="$(languages | grep '^en ' || true)
$(languages | grep -v '^en ' || true)"
    while IFS=' ' read -r -u 3 LANG_ID LANG_TITLE; do
      while true; do
        ask "  Rules PDF in $LANG_TITLE (Enter to skip)"
        [ -n "$REPLY_TEXT" ] || break
        if CHECKED="$(rulebook check --from "$USER_CWD" --rules "$LANG_ID=$REPLY_TEXT" 2>&1)"; then
          ok "$(printf '%s\n' "$CHECKED" | sed -n 2p | sed 's/^ *//')"
          RULES+=("$LANG_ID=$REPLY_TEXT"); break
        fi
        err "$(printf '%s\n' "$CHECKED" | sed -n 1p | sed 's/^Error: //')"
      done
    done 3<<EOF
$ORDER
EOF
  fi
fi

resolve_game || { err "$GAME_PROBLEM"; exit 1; }
RULE_ARGS=(); RULES_LINE=""
for rule in ${RULES[@]+"${RULES[@]}"}; do
  RULE_ARGS+=(--rules "$rule"); RULES_LINE="$RULES_LINE --rules $(quote "$rule")"
done
# The PDFs are read here (nothing is sent), so a missing file or a wrong language stops the run before anything exists
LIST=""
if [ ${#RULE_ARGS[@]} -gt 0 ]; then
  LIST="$(rulebook check --from "$USER_CWD" "${RULE_ARGS[@]}" 2>&1)" \
    || { err "$(printf '%s\n' "$LIST" | sed -n 1p | sed 's/^Error: //')"; exit 1; }
fi

# ---------- summary, then the go ----------
HOST="$(studio_host "$SLUG")"
title "New game"
echo "  Name    $NAME"
echo "  Slug    $SLUG  (games/$SLUG, http://localhost:3100/$SLUG)"
if [ -n "$LIST" ]; then
  echo "  Rules"
  printf '%s\n' "$LIST" | sed -e 1d -e 's/^/  /'
else
  echo "  Rules   none yet: pnpm game-rules $SLUG --rules <file.pdf> adds them later"
fi
echo
echo "  Steps"
STEP=0
step() { STEP=$((STEP + 1)); echo "    $STEP. $1"; }
step "games/$SLUG from the template, registered in packages/games (not live)"
step "Sanity: the project \"$SLUG\" (created, or found by name), its public dataset, CORS, a write token in"
echo "       apps/web/.env.local, the Studio deployed at https://$HOST.sanity.studio"
if [ -n "$LIST" ]; then step "The rules PDFs in the draft of the game's Settings (nothing is published)"; fi
step "setup-env: the pending Supabase migrations (preview, then production) and the variables of apps/web, pushed to"
echo "       the Vercel project \"pbgo\""
if [ "$INTERACTIVE" = 1 ] && [ "$OPEN" = 1 ]; then step "The Studio opens in the browser"; fi
if [ "$PUSH" = 1 ]; then step "A commit with the new game only, pushed as a branch for a pull request"; fi
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != main ]; then
  warn "You are on $BRANCH, not main: the setup-env step applies this checkout's Supabase migrations to production too, make sure none is unmerged"
fi
if [ "$DRY" = 1 ]; then
  echo
  echo "Nothing was created (--dry-run): the same command without it creates the game."
  exit 0
fi
if [ "$INTERACTIVE" = 1 ] && [ "$YES" = 0 ]; then
  echo
  confirm "Create it?"
fi

# ---------- code, Sanity ----------
echo
bash scripts/new-game.sh "$SLUG" --name="$NAME"
bash scripts/go-live.sh "$SLUG" || {
  err "go-live failed (see above): games/$SLUG exists and is registered. Fix the cause, then run:"
  echo "    pnpm go-live $SLUG"
  [ -z "$LIST" ] || echo "    pnpm game-rules $SLUG$RULES_LINE"
  echo "    pnpm setup-env"
  exit 1
}
export SLUG
PID="$(registry 'GAMES.find((g) => g.slug === process.env.SLUG)?.sanityProjectId')"
is_project_id "$PID" || { err "go-live left no Sanity project id in the registry for $SLUG"; exit 1; }

# What is left to do by hand, when a step below fails: the run goes on, and says so at the end
PROBLEMS=()

# ---------- the rules PDFs, in the draft of Settings ----------
if [ -n "$LIST" ]; then
  title "Rules"
  if ! rulebook place --slug "$SLUG" --project "$PID" --from "$USER_CWD" "${RULE_ARGS[@]}" --apply; then
    PROBLEMS+=("the rules PDFs are not in Sanity yet: pnpm game-rules $SLUG$RULES_LINE")
  fi
fi

# ---------- Supabase and Vercel ----------
if ! bash scripts/setup-env.sh; then
  PROBLEMS+=("the environment is not set up: pnpm setup-env (the write token of $SLUG is not on Vercel until it runs)")
fi

# ---------- the Studio ----------
STOKEN="$(sanity_token)"
STUDIO_URL="https://$(studio_host "$SLUG").sanity.studio"
STUDIO_UP=0
if [ -n "$STOKEN" ] && studio_deployed "$PID" "$(studio_host "$SLUG")"; then STUDIO_UP=1
else PROBLEMS+=("the Studio is not deployed at $STUDIO_URL (log: ${TMPDIR:-/tmp}/pbgo-studio-$SLUG.log): fix the cause, then pnpm go-live $SLUG deploys it"); fi
if [ "$STUDIO_UP" = 1 ] && [ "$INTERACTIVE" = 1 ] && [ "$OPEN" = 1 ]; then open_url "$STUDIO_URL" || true; fi

title "Your turn"
if [ "$STUDIO_UP" = 1 ]; then echo "  Studio:   $STUDIO_URL"; fi
echo "  Fields:   in Claude Code run /game-new $SLUG: it reads the rules and proposes the categories and the fields before"
echo "            building anything"
echo "  Play:     pnpm dev → http://localhost:3100/$SLUG  (gamemaster: http://localhost:3100/gamemaster/$SLUG)"
echo "  Rules:    pnpm game-rules $SLUG --rules fr=regles.pdf  adds or replaces a rulebook, whatever its size"
if [ "$PUSH" = 0 ]; then
  echo "  Commit:   games/$SLUG, packages/games, apps/web/.env.example and pnpm-lock.yaml, then push a"
  echo "            branch and open a pull request (--push does it next time)"
fi

# ---------- --push: the new game in a commit, pushed ----------
if [ "$PUSH" = 1 ]; then
  if [ ${#PROBLEMS[@]} -gt 0 ]; then
    PROBLEMS+=("nothing was committed or pushed (--push): do it by hand once the above is fixed")
  else
    if [ "$(git branch --show-current)" = main ]; then git switch -c "$SLUG"; fi
    git add "games/$SLUG" packages/games apps/web/.env.example pnpm-lock.yaml
    LEAKS="$(git diff --cached --name-only | grep -E '(^|/)(\.env|\.env\..*\.local|\.env\.local|\.sanity-project-id)$|(^|/)\.vercel/' || true)"
    if [ -n "$LEAKS" ]; then
      git reset -q
      echo "Not committed, these files must stay local:"; echo "$LEAKS"; exit 1
    fi
    git commit -q -m "✨($SLUG): new game from the template"
    git push -u origin HEAD
    echo "Pushed $(git branch --show-current): open a pull request, $SLUG stays off production until live: true in the registry"
  fi
fi

if [ ${#PROBLEMS[@]} -gt 0 ]; then
  title "Left to fix"
  for problem in "${PROBLEMS[@]}"; do err "$problem"; done
  exit 1
fi

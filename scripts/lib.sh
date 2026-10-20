# Helpers shared by new-game.sh, go-live.sh, add-game.sh, game-rules.sh and setup-env.sh (sourced, needs ROOT): output,
# JSON, .env files, the games registry and the rules of a slug and a name, Sanity, the rulebook tool. Secret values are
# never printed: they go from an API response or a file straight into a file.

ok()    { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()   { printf "  \033[31m✗\033[0m %s\n" "$*"; }
# skip <what> <reason>: a step left as it is on purpose, neither a success nor a failure
skip()  { printf "    %s \033[2m– skipped (%s)\033[0m\n" "$1" "$2"; }
title() { printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$*"; }

# json <expression>: evaluates the expression on the JSON read from stdin (`o`), prints "" on any error
json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=($1);console.log(v??'')}catch{console.log('')}})"; }

# envget <file> <KEY>: value of KEY in a .env file ("" when absent)
envget() {
  [ -f "$1" ] || return 0
  node -e '
    const [file, key] = process.argv.slice(1)
    for (const line of require("fs").readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m && m[1] === key) { console.log(m[2].trim().replace(/^(["\x27])(.*)\1$/, "$2")); break }
    }' "$1" "$2"
}

# envset <file> <KEY> <value>: sets KEY in a .env file (mode 600), in place when the key is already there
envset() {
  KEY="$2" VAL="$3" node -e '
    const fs = require("fs"), file = process.argv[1], { KEY, VAL } = process.env
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : []
    const i = lines.findIndex((l) => new RegExp(`^\\s*(export\\s+)?${KEY}\\s*=`).test(l))
    if (i >= 0) lines[i] = `${KEY}=${VAL}`
    else { while (lines.length && lines.at(-1) === "") lines.pop(); lines.push(`${KEY}=${VAL}`) }
    fs.writeFileSync(file, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 })
    fs.chmodSync(file, 0o600)' "$1"
}

# envadd <file> <KEY> <value>: gives KEY its value in a .env file only when the file has none (absent, or empty): a value
# that is already there is never overwritten. Status 0 when the file now holds a value for KEY (written, or already
# there), non-zero when the write failed
envadd() {
  [ -z "$(envget "$1" "$2")" ] || return 0
  envset "$1" "$2" "$3"
}

# A value that can sit unquoted in a .env file and in a JSON string
safe() { [[ "$1" =~ ^[A-Za-z0-9._:/@+=~-]*$ ]]; }

# password: 24 random characters, without look-alikes
password() { node -e 'const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";console.log(Array.from(require("crypto").randomBytes(24),b=>c[b%c.length]).join(""))'; }

# session_secret: 64 random URL-safe characters (48 bytes), the key that signs the gamemaster session cookie
session_secret() { node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'; }

# registry <expression>: evaluates the expression on GAMES (packages/games/src/registry.ts, imported by Node, which
# strips its types); an array prints one item per line. Pass values through the environment (process.env).
registry() {
  REGISTRY="$ROOT/packages/games/src/registry.ts" node --input-type=module -e "
    const { pathToFileURL } = await import('node:url')
    const { GAMES } = await import(pathToFileURL(process.env.REGISTRY).href)
    const v = ($1)
    console.log(Array.isArray(v) ? v.join('\n') : (v ?? ''))"
}

# slug_rules <expression>: evaluates the expression on the exports of packages/games/src/slug.ts (`m`) and on GAMES. That
# file is the one definition of what a game's slug and name can be (the registry test reads it too), so the scripts and the
# tests cannot disagree. Prints the result, "" for undefined. Pass values through the environment (process.env).
slug_rules() {
  SLUG_RULES="$ROOT/packages/games/src/slug.ts" REGISTRY="$ROOT/packages/games/src/registry.ts" node --input-type=module -e "
    const { pathToFileURL } = await import('node:url')
    const m = await import(pathToFileURL(process.env.SLUG_RULES).href)
    const { GAMES } = await import(pathToFileURL(process.env.REGISTRY).href)
    const v = ($1)
    console.log(v ?? '')"
}
# slug_of_name <name>: the slug a name makes (The Crew → the-crew), "" when it makes none
slug_of_name() { NAME_IN="$1" slug_rules 'm.slugFromName(process.env.NAME_IN)'; }
# clean_name <name>: the name as it is kept (trimmed, single spaces)
clean_name() { NAME_IN="$1" slug_rules 'm.cleanName(process.env.NAME_IN)'; }
# name_of_slug <slug>: the name a slug makes (the-crew → The Crew)
name_of_slug() { SLUG_IN="$1" slug_rules 'm.nameFromSlug(process.env.SLUG_IN)'; }
# name_problem <name>, slug_problem <slug>: what is wrong with the name or the slug of a new game, in a sentence; "" when
# nothing is (a slug also fails when a game of the registry has it)
name_problem() { NAME_IN="$1" slug_rules 'm.nameProblem(process.env.NAME_IN)'; }
slug_problem() { SLUG_IN="$1" slug_rules 'm.slugProblem(process.env.SLUG_IN, GAMES.map((g) => g.slug))'; }

# resolve_game: settles SLUG and NAME of a new game from what was given (either may be empty, not both): the slug a name makes,
# the name a slug makes, the name cleaned. Succeeds with both set. On a problem it fails and sets GAME_PROBLEM to a sentence
# (not printed: the caller decides where it goes). Not run in a subshell, or the variables would be lost.
resolve_game() {
  GAME_PROBLEM=""
  if [ -n "$NAME" ]; then
    GAME_PROBLEM="$(name_problem "$NAME")"
    [ -z "$GAME_PROBLEM" ] || return 1
    NAME="$(clean_name "$NAME")"
  fi
  if [ -z "$SLUG" ]; then
    SLUG="$(slug_of_name "$NAME")"
    [ -n "$SLUG" ] || { GAME_PROBLEM="\"$NAME\" makes no slug (no Latin letter or digit): give the slug as well"; return 1; }
  fi
  GAME_PROBLEM="$(slug_problem "$SLUG")"
  [ -z "$GAME_PROBLEM" ] || return 1
  [ ! -e "$ROOT/games/$SLUG" ] || { GAME_PROBLEM="games/$SLUG already exists"; return 1; }
  [ -n "$NAME" ] || NAME="$(name_of_slug "$SLUG")"
}

# A real Sanity project id (not empty, not the __SANITY_PROJECT_ID__ placeholder), as isProjectId in @pbgo/core
is_project_id() { [[ "$1" =~ ^[a-z0-9-]+$ ]]; }

# Variable of a game's Sanity write token, as writeTokenName in @pbgo/core: sky-team → SANITY_API_WRITE_TOKEN_SKY_TEAM
token_name() { printf "SANITY_API_WRITE_TOKEN_%s" "$(printf "%s" "$1" | tr 'a-z-' 'A-Z_')"; }

SANITY_API="https://api.sanity.io/v2021-06-07"
# Token of the Sanity CLI login (`npx sanity login`), "" when logged out
sanity_token() { node -e 'try{console.log(require(require("os").homedir()+"/.config/sanity/config.json").authToken||"")}catch{console.log("")}'; }
S() { curl -s -H "Authorization: Bearer $STOKEN" -H "Content-Type: application/json" "$@"; }

# sanity_write_token <project id> <env file> <KEY>: creates an editor token in the project and writes it to KEY
sanity_write_token() {
  local key
  key="$(S -X POST "$SANITY_API/projects/$1/tokens" -d '{"label":"apps/web admin (editor)","roleName":"editor"}' | json "o.key")"
  [ -n "$key" ] || return 1
  envset "$2" "$3" "$key"
}

# studio_host <slug>: the host of the game's Studio (<host>.sanity.studio): its .env, else the one written in
# sanity.cli.ts, else the slug
studio_host() {
  local studio="$ROOT/games/$1/apps/studio" host
  host="$(envget "$studio/.env" SANITY_STUDIO_HOST)"
  [ -n "$host" ] || host="$(sed -nE 's/.*studioHost:[^"]*"([a-z0-9-]+)".*/\1/p' "$studio/sanity.cli.ts" 2>/dev/null | head -1 || true)"
  [ -n "$host" ] || host="$1"
  printf "%s" "$host"
}

# studio_deployed <project id> <host>: succeeds when <host>.sanity.studio is a Studio deployed in the project (needs
# STOKEN). Read from the list of the project's studios: the address of a Studio answers 404 to curl whatever happens
studio_deployed() {
  [ "$(curl -s -H "Authorization: Bearer $STOKEN" "https://$1.api.sanity.io/v2024-08-01/user-applications?appType=studio" \
    | json "o.some((a) => a.appHost === '$2' && a.activeDeployment) ? 'yes' : ''")" = yes ]
}

# rulebook <args…>: the rulebook tool of @pbgo/content-kit (check or place the rules PDFs of a game), run by Node, which
# strips its types. See packages/content-kit/README.md
rulebook() { node --disable-warning=ExperimentalWarning "$ROOT/packages/content-kit/src/rulebook-bin.ts" "$@"; }

# languages: the languages of the site, one "<id> <title>" per line (fr Français…), from @pbgo/studio-kit/constants, the one
# list the Studio fields and the translations read
languages() {
  CONSTANTS="$ROOT/packages/studio-kit/src/constants.ts" node --input-type=module -e "
    const { pathToFileURL } = await import('node:url')
    const { LANGUAGES } = await import(pathToFileURL(process.env.CONSTANTS).href)
    for (const { id, title } of LANGUAGES) console.log(id + ' ' + title)"
}

# quote <text>: the text as a shell would take it back (single quotes unless it is plain), for a command printed to be typed
quote() {
  case "$1" in
    ""|*[!A-Za-z0-9._/=:@%+,-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}

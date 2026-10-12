# Helpers shared by go-live.sh and setup-env.sh (sourced, needs ROOT): output, JSON, .env files, the games registry,
# Sanity. Secret values are never printed: they go from an API response or a file straight into a file.

ok()    { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn()  { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()   { printf "  \033[31m✗\033[0m %s\n" "$*"; }
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

# A value that can sit unquoted in a .env file and in a JSON string
safe() { [[ "$1" =~ ^[A-Za-z0-9._:/@+=~-]*$ ]]; }

# password: 24 random characters, without look-alikes
password() { node -e 'const c="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";console.log(Array.from(require("crypto").randomBytes(24),b=>c[b%c.length]).join(""))'; }

# registry <expression>: evaluates the expression on GAMES (packages/games/src/registry.ts, imported by Node, which
# strips its types); an array prints one item per line. Pass values through the environment (process.env).
registry() {
  REGISTRY="$ROOT/packages/games/src/registry.ts" node --input-type=module -e "
    const { pathToFileURL } = await import('node:url')
    const { GAMES } = await import(pathToFileURL(process.env.REGISTRY).href)
    const v = ($1)
    console.log(Array.isArray(v) ? v.join('\n') : (v ?? ''))"
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

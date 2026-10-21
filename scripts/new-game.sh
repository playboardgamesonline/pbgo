#!/usr/bin/env bash
# pnpm new-game <slug> [--name "<Game Name>"]   e.g. pnpm new-game the-crew --name "The Crew"
# pnpm new-game --name "<Game Name>"            the slug comes from the name (The Crew → the-crew)
# Creates games/<slug> from template/ and registers it in packages/games (registry entry, server loader, client
# runtime, dependency): binding @pbgo-game/<slug>, engine @<slug>/engine, studio <slug>-studio. The game is not live:
# playable outside production only, at http://localhost:3100/<slug>.
# The name is what the hub, the Studio and the docs of the game print; without --name it is the slug, capitalised
# (the-crew → The Crew). The slug and the name follow packages/games/src/slug.ts, which the registry test reads too.
# Next: pnpm go-live <slug> (Sanity project, studio, write token), or pnpm add-game for both and the rules PDF.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source scripts/lib.sh

usage() {
  echo 'Usage: pnpm new-game <slug> [--name "<Game Name>"]   e.g. pnpm new-game the-crew --name "The Crew"'
  echo '       pnpm new-game --name "<Game Name>"            the slug comes from the name'
  exit "${1:-1}"
}

SLUG=""; NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --name) { [ $# -ge 2 ] && [[ "$2" != -* ]]; } || { echo "--name needs a value"; usage; }; NAME="$2"; shift ;;
    --name=*) NAME="${1#--name=}" ;;
    --) ;;
    -*) echo "Unknown option $1"; usage ;;
    *) [ -z "$SLUG" ] || { echo "One slug only, got \"$SLUG\" and \"$1\""; usage; }; SLUG="$1" ;;
  esac
  shift
done

[ -n "$SLUG$NAME" ] || usage
resolve_game || { echo "$GAME_PROBLEM"; exit 1; }
DEST="games/$SLUG"

mkdir -p "$DEST"
tar -C template --exclude=node_modules --exclude=.next --exclude=dist --exclude=.vercel --exclude=.sanity \
  --exclude=.sanity-project-id --exclude='.env' --exclude='.env*.local' --exclude='*.tsbuildinfo' --exclude=assets \
  --exclude=docs -cf - . | tar -C "$DEST" -xf -
mkdir -p "$DEST/assets"

GAME_NAME="$NAME" node - "$DEST" "$SLUG" <<'JS'
const fs = require("fs"), path = require("path")
const [dest, slug] = process.argv.slice(2)
const title = process.env.GAME_NAME
const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(slug) ? slug : JSON.stringify(slug)
const tokenName = `SANITY_API_WRITE_TOKEN_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`
// A string as a TypeScript literal: the name can hold a quote or a backslash
const lit = JSON.stringify

const edit = (file, fn) => {
  if (!fs.existsSync(file)) throw new Error(`${file} not found`)
  const before = fs.readFileSync(file, "utf8"), after = fn(before)
  if (after === before) throw new Error(`${file}: nothing to change, its layout may have changed`)
  fs.writeFileSync(file, after)
}
const editJson = (file, fn) => edit(file, (s) => JSON.stringify(fn(JSON.parse(s)), null, 2) + "\n")
/** Inserts `text` before the line that closes the block opened by the line starting with `opening`. */
const insertBefore = (s, opening, closing, text) => {
  const lines = s.split("\n"), start = lines.findIndex((l) => l.startsWith(opening))
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && l === closing)
  if (end < 0) throw new Error(`block "${opening}" not found`)
  lines.splice(end, 0, text)
  return lines.join("\n")
}

// The game's packages: names and imports of the template → the game's
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "node_modules" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
for (const file of walk(dest).filter((f) => /\.(ts|tsx|mts|js|mjs|json|md|css)$/.test(f))) {
  const s = fs.readFileSync(file, "utf8")
  const t = s.replaceAll("@pbgo-game/template", `@pbgo-game/${slug}`).replaceAll("@template/engine", `@${slug}/engine`)
    .replaceAll("template-studio", `${slug}-studio`)
  if (t !== s) fs.writeFileSync(file, t)
}
editJson(path.join(dest, "package.json"), (p) => ({ ...p, description: `${title}: binding of the game for apps/web (engine, board, site constants), served at /${slug}.` }))
// A function as the replacement: a string would read `$&` or `$1` in the name as a pattern
edit(path.join(dest, "src/lib/site.ts"), (s) => s.replace(/^export const SLUG = ".*"$/m, () => `export const SLUG = ${lit(slug)}`)
  .replace(/^export const NAME = ".*"$/m, () => `export const NAME = ${lit(title)}`))
const studioConfig = path.join(dest, "apps/studio/sanity.config.ts")
fs.writeFileSync(studioConfig, fs.readFileSync(studioConfig, "utf8").replace(/^  title: ".*",$/m, () => `  title: ${lit(title)},`))

// Docs of the game (the full guide stays in template/docs)
edit(path.join(dest, "CLAUDE.md"), (s) => s.replace(/^[\s\S]*?(?=^## )/m, () =>
  `# ${title} · Play Board Games Online\n\n${title}, served by \`apps/web\` at \`/${slug}\` (not live: playable outside production only). ` +
  `Created from \`template/\` by \`pnpm new-game\`: \`packages/engine\` is still the demo game (La Plus Haute), to replace with this game's engine. ` +
  `Full guide: \`template/docs/GAME_GUIDE.md\`.\n\n`))
fs.writeFileSync(path.join(dest, "README.md"), `# ${title}

Served by \`apps/web\` at \`/${slug}\`, administered in the gamemaster at \`/gamemaster/${slug}\`. Created from \`template/\` (\`pnpm new-game ${slug}\`).

\`\`\`bash
pnpm dev                          # apps/web on http://localhost:3100, this game at /${slug}
pnpm dev:studio ${slug}           # its Sanity Studio
pnpm --filter @${slug}/engine test
pnpm typecheck
\`\`\`

See \`CLAUDE.md\` and the full guide \`template/docs/GAME_GUIDE.md\`.
`)

// Registration in packages/games: metadata (not live), server loader, client runtime, dependency
edit("packages/games/src/registry.ts", (s) => s.replace(/^\] as const satisfies readonly GameEntry\[\]$/m, (end) => `  {
    slug: ${lit(slug)},
    name: ${lit(title)},
    tagline: ${lit(`${title}, online with friends.`)},
    sanityProjectId: "__SANITY_PROJECT_ID__",
    live: false,
    indexable: false,
  },
${end}`))
edit("packages/games/src/index.ts", (s) => insertBefore(s, "const LOADERS", "}", `  ${key}: () => import("@pbgo-game/${slug}/server"),`))
edit("packages/games/src/runtime.tsx", (s) => insertBefore(s, "const RUNTIMES", "}", `  ${key}: dynamic(() => import("@pbgo-game/${slug}/runtime")),`))
editJson("packages/games/package.json", (p) => {
  const deps = { ...p.dependencies, [`@pbgo-game/${slug}`]: "workspace:*" }
  return { ...p, dependencies: Object.fromEntries(Object.keys(deps).sort().map((k) => [k, deps[k]])) }
})
// Its Sanity write token, in the list of the app's variables
edit("apps/web/.env.example", (s) => {
  const lines = s.split("\n"), last = lines.findLastIndex((l) => l.startsWith("SANITY_API_WRITE_TOKEN_"))
  lines.splice(last + 1, 0, `${tokenName}=`)
  return lines.join("\n")
})
JS

pnpm install --silent
echo "✓ $DEST created from the template as \"$NAME\" and registered in packages/games (not live)"
echo "  Play it:  pnpm dev  →  http://localhost:3100/$SLUG"
echo "  Next:     pnpm go-live $SLUG   (Sanity project, studio, write token), or pnpm add-game for all of it"

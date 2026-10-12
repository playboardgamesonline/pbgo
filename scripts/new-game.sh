#!/usr/bin/env bash
# pnpm new-game <slug>   e.g. pnpm new-game the-crew
# Creates games/<slug> from template/ and registers it in packages/games (registry entry, server loader, client
# runtime, dependency): binding @pbgo-game/<slug>, engine @<slug>/engine, studio <slug>-studio, static files in
# apps/web/public/<slug>/. The game is not live: playable outside production only, at http://localhost:3100/<slug>.
# Next: pnpm go-live <slug> (Sanity project, studio, write token), or pnpm add-game <slug> for both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
SLUG="${1:-}"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "Usage: pnpm new-game <slug>   (lowercase and dashes, e.g. the-crew)"; exit 1; }
case "$SLUG" in api|legal|design|gamemaster|login|logout) echo "\"$SLUG\" is a route of apps/web, pick another slug"; exit 1 ;; esac
DEST="games/$SLUG"
[ -e "$DEST" ] && { echo "$DEST already exists"; exit 1; }
grep -q "slug: \"$SLUG\"," packages/games/src/registry.ts && { echo "\"$SLUG\" is already in packages/games/src/registry.ts"; exit 1; }

mkdir -p "$DEST"
tar -C template --exclude=node_modules --exclude=.next --exclude=dist --exclude=.vercel --exclude=.sanity \
  --exclude=.sanity-project-id --exclude='.env' --exclude='.env*.local' --exclude='*.tsbuildinfo' --exclude=assets \
  --exclude=docs -cf - . | tar -C "$DEST" -xf -
mkdir -p "$DEST/assets" "apps/web/public/$SLUG"

node - "$DEST" "$SLUG" <<'JS'
const fs = require("fs"), path = require("path")
const [dest, slug] = process.argv.slice(2)
const title = slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(slug) ? slug : JSON.stringify(slug)
const tokenName = `SANITY_API_WRITE_TOKEN_${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`

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
edit(path.join(dest, "src/lib/site.ts"), (s) => s.replace(/^export const SLUG = ".*"$/m, `export const SLUG = "${slug}"`)
  .replace(/^export const NAME = ".*"$/m, `export const NAME = "${title}"`))
const studioConfig = path.join(dest, "apps/studio/sanity.config.ts")
fs.writeFileSync(studioConfig, fs.readFileSync(studioConfig, "utf8").replace(/^  title: ".*",$/m, `  title: "${title}",`))

// Docs of the game (the full guide stays in template/docs)
edit(path.join(dest, "CLAUDE.md"), (s) => s.replace(/^[\s\S]*?(?=^## )/m,
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
    slug: "${slug}",
    name: "${title}",
    tagline: "${title}, online with friends.",
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
echo "✓ $DEST created from the template and registered in packages/games (not live)"
echo "  Play it:  pnpm dev  →  http://localhost:3100/$SLUG"
echo "  Next:     pnpm go-live $SLUG   (Sanity project, studio, write token)"

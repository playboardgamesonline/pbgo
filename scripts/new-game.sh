#!/usr/bin/env bash
# Crée games/<jeu> à partir du template.  Usage : pnpm new-game <jeu>   (ex. pnpm new-game the-crew)
# Ensuite : pnpm go-live <jeu>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
SLUG="${1:-}"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "Usage : pnpm new-game <jeu>  (minuscules et tirets, ex. the-crew)"; exit 1; }
DEST="games/$SLUG"
[ -e "$DEST" ] && { echo "$DEST existe déjà"; exit 1; }

mkdir -p "$DEST"
tar -C template --exclude=node_modules --exclude=.next --exclude=dist --exclude=.vercel --exclude=.sanity \
  --exclude=.sanity-project-id --exclude='.env' --exclude='.env*.local' --exclude=assets -cf - . | tar -C "$DEST" -xf -
mkdir -p "$DEST/assets"

node - "$DEST" "$SLUG" <<'JS'
const fs = require("fs"), path = require("path")
const [dest, slug] = process.argv.slice(2)
const edit = (f, fn) => { const p = path.join(dest, f); if (fs.existsSync(p)) fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8"))) }
const pkg = (f, fn) => edit(f, s => JSON.stringify(fn(JSON.parse(s)), null, 2) + "\n")
pkg("package.json", p => { p.name = slug; delete p.packageManager
  for (const k in p.scripts ?? {}) p.scripts[k] = p.scripts[k].replaceAll("template-web", `${slug}-web`).replaceAll("template-studio", `${slug}-studio`)
  return p })
pkg("apps/web/package.json", p => { p.name = `${slug}-web`
  if (p.dependencies?.["@game/engine"]) { delete p.dependencies["@game/engine"]; p.dependencies[`@${slug}/engine`] = "workspace:*" }
  return p })
pkg("apps/studio/package.json", p => ({ ...p, name: `${slug}-studio` }))
pkg("packages/engine/package.json", p => ({ ...p, name: `@${slug}/engine` }))
// games/<jeu>/apps/web est un niveau plus bas que template/apps/web : chemins @source de Tailwind
edit("apps/web/src/app/globals.css", (s) => s.replaceAll('@source "../../../../../packages/', '@source "../../../../../../packages/'))
// imports @game/engine → @<slug>/engine
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === "node_modules" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
for (const f of walk(dest).filter(f => /\.(ts|tsx|mts|js|mjs|json|md)$/.test(f))) {
  const s = fs.readFileSync(f, "utf8")
  const t = s.replaceAll("@game/engine", `@${slug}/engine`).replaceAll("--filter template-", `--filter ${slug}-`)
  if (t !== s) fs.writeFileSync(f, t)
}
JS

echo "✓ $DEST créé depuis le template"
echo "  Suite : pnpm install  →  pnpm dev $SLUG  →  pnpm go-live $SLUG"

#!/usr/bin/env bash
# Audite les jeux par rapport au template : fichiers manquants, écarts.
# Usage : pnpm check-games [jeu...]            → rapport
#         pnpm check-games --fix [jeu...]      → copie les fichiers MANQUANTS depuis le template (n'écrase jamais rien)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
FIX=0; [ "${1:-}" = "--fix" ] && { FIX=1; shift; }
node - "$FIX" "$@" <<'JS'
const fs = require("fs"), path = require("path")
const [fix, ...only] = process.argv.slice(2)
const FIX = fix === "1"
const EXCLUDE = /(^|\/)(node_modules|\.next|dist|\.vercel|\.sanity|\.turbo|assets|\.env.*|\.sanity-project-id|package\.json|pnpm-lock\.yaml|CLAUDE\.md|README\.md|MIGRATION\.md)$/
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const rel = path.relative(base, path.join(d, e.name))
  if (EXCLUDE.test(rel)) return []
  return e.isDirectory() ? walk(path.join(d, e.name), base) : [rel]
})
// fichiers propres à chaque jeu : jamais copiés ni comparés
const GAME_OWN = [/^packages\/engine\//, /^apps\/web\/src\/lib\/site\.ts$/, /^apps\/web\/src\/components\/(game|game3d)\//, /^apps\/web\/public\//, /^apps\/studio\//, /^supabase\//, /^docs\//, /^apps\/web\/src\/app\/(icon|apple-icon|favicon|opengraph|twitter)/, /^apps\/web\/src\/sanity\//]
const ALL = walk("template")
// Jeu « coquille » : s'il n'a pas encore son plateau / moteur (marqueur absent), on reprend la démo du template pour ces dossiers
const SHELL_MARKERS = [
  { marker: "apps/web/src/components/game/game.tsx", re: /^apps\/web\/src\/components\/(game|game3d)\// },
  { marker: "packages/engine/src/demo/game.ts", re: /^packages\/engine\// },
]
const engineIsShell = (g) => { const f = `games/${g}/packages/engine/src/index.ts`; return !fs.existsSync(f) || !/GAME/.test(fs.readFileSync(f, "utf8")) }
const tplFor = (g) => ALL.filter((f) => !GAME_OWN.some((r) => r.test(f)) || (SHELL_MARKERS[0].re.test(f) && !fs.existsSync(`games/${g}/${SHELL_MARKERS[0].marker}`)) || (SHELL_MARKERS[1].re.test(f) && engineIsShell(g) && !/(^|\/)index\.ts$/.test(f)) || (SHELL_MARKERS[1].re.test(f) && engineIsShell(g) && f === "packages/engine/src/index.ts" && !fs.existsSync(`games/${g}/${f}`)))
const games = fs.readdirSync("games").filter((g) => fs.existsSync(`games/${g}/package.json`) && (only.length === 0 || only.includes(g)))
let problems = 0
for (const g of games) {
  const slug = g
  const tpl = tplFor(g)
  const missing = tpl.filter((f) => !fs.existsSync(`games/${g}/${f}`))
  const differ = tpl.filter((f) => fs.existsSync(`games/${g}/${f}`) && /^apps\/web\/src\/(binding|lib|components\/[^/]+\.tsx)/.test(f) && fs.readFileSync(`template/${f}`, "utf8").replaceAll("@game/engine", `@${slug}/engine`) !== fs.readFileSync(`games/${g}/${f}`, "utf8"))
  const pkg = JSON.parse(fs.readFileSync(`games/${g}/apps/web/package.json`, "utf8"))
  const tplPkg = JSON.parse(fs.readFileSync("template/apps/web/package.json", "utf8"))
  const deps = Object.keys({ ...tplPkg.dependencies }).filter((d) => d !== "@game/engine" && !(d in (pkg.dependencies ?? {})))
  const scripts = Object.keys(tplPkg.scripts ?? {}).filter((s) => !(s in (pkg.scripts ?? {})))
  const shell = !fs.existsSync(`games/${g}/${SHELL_MARKERS[0].marker}`)
  const live = missing.length === 0 && (deps.length === 0 || !shell)
  console.log(`\n${live ? "✓" : "✗"} ${g}  — manquants: ${missing.length} · dépendances web manquantes: ${deps.length} · scripts manquants: ${scripts.length} · fichiers divergents: ${differ.length}`)
  if (missing.length) console.log("   manquants:", missing.slice(0, 5).join(", "), missing.length > 5 ? `… (+${missing.length - 5})` : "")
  if (deps.length) console.log("   deps:", deps.join(", "))
  if (scripts.length) console.log("   scripts:", scripts.join(", "))
  if (!live) problems++
  if (FIX && missing.length) {
    for (const f of missing) {
      const dest = `games/${g}/${f}`
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const src = fs.readFileSync(`template/${f}`)
      fs.writeFileSync(dest, /\.(tsx?|mjs|js|json|css|sh)$/.test(f) ? src.toString().replaceAll("@game/engine", `@${slug}/engine`).replaceAll("template-web", `${slug}-web`).replaceAll("template-studio", `${slug}-studio`) : src)
      if (f.startsWith("scripts/")) fs.chmodSync(dest, 0o755)
    }
    console.log(`   → ${missing.length} fichier(s) copié(s) (aucun écrasé)`)
    if ((deps.length || scripts.length) && shell) {
      pkg.dependencies = { ...pkg.dependencies, ...Object.fromEntries(deps.map((d) => [d, tplPkg.dependencies[d]])) }
      pkg.scripts = { ...Object.fromEntries(scripts.map((s) => [s, tplPkg.scripts[s].replaceAll("template-", `${slug}-`)])), ...pkg.scripts }
      fs.writeFileSync(`games/${g}/apps/web/package.json`, JSON.stringify(pkg, null, 2) + "\n")
      console.log("   → package.json web complété : lance pnpm install")
    }
  }
}
console.log(problems ? `\n${problems} jeu(x) en retard sur le template.${FIX ? "" : "  Corriger : pnpm check-games --fix"}` : "\nTous les jeux sont à jour.")
JS

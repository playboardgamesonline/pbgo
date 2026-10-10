#!/usr/bin/env node
// One version per dependency: fails when a workspace package declares its own version
// for a dependency of the pnpm catalog (pnpm-workspace.yaml), or when a dependency
// missing from the catalog is declared by several packages.
// Usage: pnpm check:catalog
import { globSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]

/** Top-level YAML sections of pnpm-workspace.yaml, as their indented lines. */
function sections(yaml) {
  const out = {}
  let current
  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const top = line.match(/^([\w-]+):/)
    if (top) out[(current = top[1])] = []
    else if (current) out[current].push(line)
  }
  return out
}

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "")
const keyOf = (line) => unquote(line.replace(/:.*$/, ""))

const workspace = sections(readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8"))
const globs = (workspace.packages ?? []).map((l) => unquote(l.replace(/^\s*-\s*/, "")))

// Default catalog ("catalog:") and named catalogs ("catalogs:" → "catalog:<name>")
const catalog = new Set((workspace.catalog ?? []).map(keyOf))
for (const line of workspace.catalogs ?? []) if (/^ {4}\S/.test(line)) catalog.add(keyOf(line))

const manifests = [
  join(ROOT, "package.json"),
  ...globs
    .filter((g) => !g.startsWith("!"))
    .flatMap((g) => globSync(`${g}/package.json`, { cwd: ROOT, exclude: (p) => p.includes("node_modules") }))
    .map((p) => join(ROOT, p)),
]

const errors = []
const outside = new Map() // dependency missing from the catalog → packages declaring it
const used = new Set()
for (const file of [...new Set(manifests)].sort()) {
  const pkg = JSON.parse(readFileSync(file, "utf8"))
  const where = relative(ROOT, file)
  for (const field of FIELDS) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      if (spec.startsWith("workspace:")) continue
      if (spec.startsWith("catalog:")) {
        used.add(name)
        if (!catalog.has(name)) errors.push(`${where}: ${field}.${name} uses "${spec}" but is missing from the catalog`)
      } else if (catalog.has(name)) {
        errors.push(`${where}: ${field}.${name} declares "${spec}", use "catalog:"`)
      } else {
        outside.set(name, [...(outside.get(name) ?? []), where])
      }
    }
  }
}
for (const [name, packages] of outside) {
  if (new Set(packages).size > 1) errors.push(`${name} is declared by ${packages.join(", ")}: move it to the catalog`)
}

const unused = [...catalog].filter((name) => !used.has(name))
if (unused.length) console.warn(`Catalog entries used by no package: ${unused.join(", ")}`)

if (errors.length) {
  console.error(`Dependency versions must come from the catalog in pnpm-workspace.yaml:\n  ${errors.join("\n  ")}`)
  process.exit(1)
}
console.log(`Catalog OK: ${manifests.length} packages, ${catalog.size} catalog dependencies`)

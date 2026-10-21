#!/usr/bin/env node
// apps/web/public holds the platform's own files and nothing else: what a game shows (pictures, sounds, fonts) comes from its
// Sanity project, and a copy here would hide a value Sanity does not have. Fails when the folder holds any other file, or lacks
// one of the platform's.
// The deployment only runs the build, never the tests, so `apps/web` runs this before `next build`; the test of
// packages/games/src/registry.test.ts holds the same list.
// Usage: pnpm check:public
import { readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC = join(ROOT, "apps/web/public")

/** The platform's own files: the hub's icon. A static file answers before `[game]`, so `favicon.ico` is never read as a slug. */
const ALLOWED = ["favicon.ico"]

/** Every file under `dir`, as a path relative to `base`. `.DS_Store` is git-ignored macOS litter, it never reaches a deployment. */
function files(dir, base = dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }
  return entries.flatMap((entry) => {
    if (entry.name === ".DS_Store") return []
    const path = join(dir, entry.name)
    return entry.isDirectory() ? files(path, base) : [path.slice(base.length + 1)]
  })
}

const found = files(PUBLIC)
const unexpected = found.filter((file) => !ALLOWED.includes(file)).sort()
const missing = ALLOWED.filter((file) => !found.includes(file))

if (unexpected.length || missing.length) {
  console.error("apps/web/public holds the platform's own files only:")
  for (const file of unexpected) console.error(`  - ${file} should not be here`)
  for (const file of missing) console.error(`  - ${file} is missing`)
  console.error(
    "A game's pictures, sounds and fonts live in its Sanity project, never in the repo. A file that belongs to the platform itself\n" +
      "goes in ALLOWED here and in packages/games/src/registry.test.ts.",
  )
  process.exit(1)
}

console.log(`apps/web/public: ${found.length} file${found.length === 1 ? "" : "s"}, all the platform's own.`)

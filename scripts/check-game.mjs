#!/usr/bin/env node
// How far a game has got on its way from a name to live, from what is in the repo. A game goes through six stages, each with checks a machine can make:
//   scaffold → engine → binding → board → content → live
// Usage: pnpm check:game <slug>                  every stage, as a report (exit 0)
//        pnpm check:game <slug> --stage engine   a gate: exit 1 when a check up to that stage fails, so "ready for the next step" is a command
//        pnpm check:game --all                   every game of the registry: the last stage it passed, and what stops it
// A check is `ok`, `warn` (look at it: a convention or something only a person can judge) or `fail` (the stage is not done). What a machine cannot see, the words of the rules, the look of the board, a table played with two seats, is in the skills
// (`.claude/skills/engine-rules`, `engine-board`, `game-go-live`); this script is the part of them that does not need a person. It reads files only: no network, no build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const STAGES = ["scaffold", "engine", "binding", "board", "content", "live"]

/** The games of the registry, as the data the hub reads: slug, the project id, and whether the game is live and indexable. */
function registry() {
  const text = readFileSync(join(ROOT, "packages/games/src/registry.ts"), "utf8")
  return [...text.matchAll(/\{\s*slug:\s*"([^"]+)"([\s\S]*?)\n {2}\}/g)].map(([, slug, body]) => ({
    slug,
    projectId: body.match(/sanityProjectId:\s*"([^"]*)"/)?.[1] ?? "",
    live: /live:\s*true/.test(body),
    indexable: /indexable:\s*true/.test(body),
  }))
}

const exists = (dir, path) => existsSync(join(dir, path))
const read = (dir, path) => (exists(dir, path) ? readFileSync(join(dir, path), "utf8") : "")
/** Every file under a folder, as paths relative to it, skipping what is not code of the game. */
function walk(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", "dist", ".sanity"].includes(name)) return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path, base) : [relative(base, path)]
  })
}
const sources = (dir) => walk(dir).filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))
/** The lines of a file that are code: comments are the author talking, not the program. */
const codeLines = (text) => text.split("\n").flatMap((line, index) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? [] : [[index + 1, line]]))
const list = (items, more = 3) => items.slice(0, more).join(", ") + (items.length > more ? ` and ${items.length - more} more` : "")

/** The board folders of a game: where `@pbgo/table` and three.js may be imported, so that the hub and the screens around the board load none of it. */
const BOARD_DIRS = ["src/components/board", "src/components/game3d"]
const inBoard = (file) => BOARD_DIRS.some((dir) => file.startsWith(dir))

const IMPURE = [
  [/Date\.now\(|new Date\(|performance\.now\(/, "reads the clock"],
  [/process\.env|\bfetch\(|from "node:/, "does I/O"],
  [/from "(react|next|three)[/"]|from "@react-three/, "imports UI code"],
]

/** The checks, in the order of the stages. Each gets the game and answers `[level, message]`. */
const CHECKS = [
  ["scaffold", "registered", (g) => (g.entry ? ["ok", `registered (live ${g.entry.live}, indexable ${g.entry.indexable})`] : ["fail", "not in packages/games/src/registry.ts: run `pnpm add-game`"])],
  ["scaffold", "sanity project", (g) => (!g.entry ? ["fail", "no entry, so no Sanity project"] : !g.entry.projectId || g.entry.projectId.startsWith("__") ? ["fail", "no Sanity project yet: `pnpm go-live <slug>` (`add-game` stopped half-way)"] : ["ok", `Sanity project ${g.entry.projectId}`])],
  [
    "scaffold",
    "files",
    (g) => {
      const need = ["package.json", "CLAUDE.md", "src/index.ts", "src/server.ts", "packages/engine/package.json", "apps/studio/sanity.config.ts"].filter((file) => !exists(g.dir, file))
      return need.length ? ["fail", `missing ${list(need, 6)}`] : ["ok", "the packages of a game are there"]
    },
  ],
  [
    "engine",
    "own engine",
    (g) => {
      const index = read(g.dir, "packages/engine/src/index.ts")
      if (!index) return ["fail", "packages/engine/src/index.ts is missing"]
      return /\.\/demo/.test(index) || exists(g.dir, "packages/engine/src/demo") ? ["fail", "still the template's demo engine (`src/demo`)"] : ["ok", "the engine is the game's own"]
    },
  ],
  ["engine", "exports GAME", (g) => (/\bGAME\b/.test(read(g.dir, "packages/engine/src/index.ts")) ? ["ok", "the engine exports `GAME`"] : ["fail", "the engine does not export `GAME`"])],
  [
    "engine",
    "pure",
    (g) => {
      const found = []
      for (const file of sources(join(g.dir, "packages/engine/src"))) {
        for (const [line, code] of codeLines(read(g.dir, join("packages/engine/src", file)))) {
          for (const [pattern, why] of IMPURE) if (pattern.test(code)) found.push(`${file}:${line} ${why}`)
          // `Math.random` is allowed as the default of a seed in `setup` and nowhere else
          if (/Math\.random\(/.test(code) && !/seed\s*=.*Math\.random/.test(code)) found.push(`${file}:${line} draws from Math.random`)
        }
      }
      return found.length ? ["fail", `an engine never does that: ${list(found)}`] : ["ok", "no clock, no I/O, no UI, no stray Math.random"]
    },
  ],
  [
    "engine",
    "up to date",
    (g) => {
      const src = join(g.dir, "packages/engine/src")
      const files = sources(src)
      const all = (pattern) => files.some((file) => pattern.test(read(g.dir, join("packages/engine/src", file))))
      const behind = []
      if (!all(/\bstandings\b/)) behind.push("no `standings` in the view (the HUD lists no points)")
      if (!/^\s*progress\b/m.test(read(g.dir, "packages/engine/src/game.ts"))) behind.push("no `progress` in the definition")
      if (/^\s+(label|help):/m.test(read(g.dir, "packages/engine/src/options.ts")) || /\blabel:/.test(read(g.dir, "packages/engine/src/results.ts"))) behind.push("words in the options or the score lines (they are keys, the words are the game's Sanity)")
      if (!exists(g.dir, "packages/engine/src/conformance.test.ts") && !exists(g.dir, "src/conformance.test.ts")) behind.push("the contract suite is not run (conformance.test.ts)")
      return behind.length ? ["warn", `behind the engine of today: ${behind.join("; ")}`] : ["ok", "standings, progress, no words in the engine, the contract suite runs"]
    },
  ],
  [
    "engine",
    "tests",
    (g) => {
      const tests = walk(join(g.dir, "packages/engine/src")).filter((file) => /\.test\.ts$/.test(file))
      if (tests.length === 0) return ["fail", "the engine has no test"]
      const layers = ["setup", "game", "view", "simulation"].filter((name) => !tests.some((file) => file.endsWith(`${name}.test.ts`)))
      return layers.length ? ["warn", `${tests.length} test files, none named ${list(layers.map((name) => `${name}.test.ts`))} (the layers of docs/engine/04-build-a-game/06-testing.md)`] : ["ok", `${tests.length} test files, the layers of the guide are there`]
    },
  ],
  [
    "binding",
    "exports GAME",
    (g) => (/\bGAME\b/.test(read(g.dir, "src/index.ts")) && !/No engine \(`?GAME`?\) yet/.test(read(g.dir, "src/index.ts")) ? ["ok", "the binding exports `GAME`"] : ["fail", "the binding does not export `GAME`: the game is not playable"]),
  ],
  [
    "binding",
    "engine dependency",
    (g) => {
      const pkg = JSON.parse(read(g.dir, "package.json") || "{}")
      const name = `@${g.slug}/engine`
      if (pkg.dependencies?.[name]) return ["ok", `${name} is a dependency of the binding`]
      return ["fail", pkg.devDependencies?.[name] ? `${name} is only a dev dependency: src/index.ts imports it at runtime` : `${name} is not a dependency of the binding`]
    },
  ],
  [
    "binding",
    "tests",
    (g) => {
      const need = ["conformance", "takeover", "error-codes"].filter((name) => !exists(g.dir, `src/${name}.test.ts`))
      return need.length ? ["fail", `missing ${list(need.map((name) => `src/${name}.test.ts`))}`] : ["ok", "conformance, takeover and error codes are tested"]
    },
  ],
  [
    "binding",
    "tests run",
    (g) => (/src\/\*\*\/\*\.test\.ts/.test(read(g.dir, "vitest.config.ts")) ? ["ok", "vitest.config.ts runs the tests of src"] : ["fail", "vitest.config.ts does not include src/**/*.test.ts: the binding's tests would never run (the older games ran only content/**)"]),
  ],
  ["binding", "look", (g) => (exists(g.dir, "src/lib/ui-theme.ts") && exists(g.dir, "src/lib/skin.ts") ? ["ok", "skin and in-game theme are there"] : ["warn", "no src/lib/skin.ts or ui-theme.ts: the game has the default look"])],
  ["board", "a board", (g) => (BOARD_DIRS.some((dir) => exists(g.dir, dir) && walk(join(g.dir, dir)).length > 0) ? ["ok", "there is a board"] : ["fail", "no board yet (src/components/board)"])],
  [
    "board",
    "lazy",
    (g) => {
      const found = sources(join(g.dir, "src")).filter((file) => !inBoard(join("src", file)) && /from "(@pbgo\/table|three|@react-three\/[^"]*)"/.test(read(g.dir, join("src", file))))
      return found.length ? ["fail", `@pbgo/table or three.js imported outside the board folder: ${list(found)}`] : ["ok", "three.js is only in the board's lazy chunk"]
    },
  ],
  [
    "board",
    "game ui lazy",
    (g) => (/dynamic\(/.test(read(g.dir, "src/ui.tsx")) ? ["ok", "src/ui.tsx loads the game lazily"] : ["warn", "src/ui.tsx does not load `Game` with `dynamic`: the hub would carry the board"]),
  ],
  [
    "board",
    "colours",
    (g) => {
      const hex = BOARD_DIRS.flatMap((dir) => sources(join(g.dir, dir)).map((file) => [join(dir, file), (read(g.dir, join(dir, file)).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []).length]))
      const total = hex.reduce((sum, [, count]) => sum + count, 0)
      return total ? ["warn", `${total} hex colours in the board (${list(hex.filter(([, count]) => count).map(([file]) => file))}): the colours of a game that asks for it come from its settings`] : ["ok", "no hex colour in the board"]
    },
  ],
  [
    "board",
    "browser check",
    (g) =>
      exists(g.dir, "check-board.config.mjs")
        ? ["ok", "check-board.config.mjs says how `pnpm check:board` presses the controls and rigs the cases"]
        : ["warn", "no check-board.config.mjs: `pnpm check:board` checks the platform's parts (the windows, a reload, the start) and presses nothing; write the game's part (`docs/scripts.md`, the model is games/flip-7)"],
  ],
  [
    "content",
    "studio guard",
    (g) => {
      if (!exists(g.dir, "apps/studio/studio-forms.test.ts")) return ["fail", "apps/studio/studio-forms.test.ts is missing (`game-sanity-create`)"]
      const studio = JSON.parse(read(g.dir, "apps/studio/package.json") || "{}")
      return studio.scripts?.test ? ["ok", "the Studio has its guard of forms"] : ["fail", "apps/studio/package.json has no `test` script: the guard of the forms would never run (it needs `vitest` and `@pbgo/content-kit` as dev dependencies too)"]
    },
  ],
  ["content", "seed", (g) => (exists(g.dir, "content/config.ts") && exists(g.dir, "content/seed.ts") ? ["ok", "the content is code with a seed"] : ["warn", "no content/config.ts and seed.ts: the content is not seeded as code (`docs/content-pipeline.md`)"])],
  [
    "content",
    "plan",
    (g) => {
      const notes = read(g.dir, "CLAUDE.md")
      return /La Plus Haute/.test(notes) ? ["warn", "CLAUDE.md still describes the template's demo game"] : /glossary/i.test(notes) && /rules/i.test(notes) ? ["ok", "CLAUDE.md has the glossary and the rules as coded"] : ["warn", "CLAUDE.md has no glossary or rules as coded: write the plan there"]
    },
  ],
  ["live", "flags", (g) => (!g.entry ? ["fail", "not registered"] : g.entry.live && g.entry.indexable ? ["ok", "live and indexable"] : g.entry.live || g.entry.indexable ? ["warn", `live ${g.entry.live} but indexable ${g.entry.indexable}: set both when the game goes live`] : ["fail", "not live: `live` and `indexable` are false"])],
]

function check(slug) {
  const entry = registry().find((game) => game.slug === slug) ?? null
  const dir = slug === "template" ? join(ROOT, "template") : join(ROOT, "games", slug)
  if (!existsSync(dir)) return { slug, missing: true, results: [], reached: null }
  const game = { slug, entry, dir }
  const results = CHECKS.map(([stage, name, run]) => ({ stage, name, ...(([level, message]) => ({ level, message }))(run(game)) }))
  // The last stage with no failure from the first stage on: the game has got that far
  let reached = null
  for (const stage of STAGES) {
    if (results.some((result) => result.stage === stage && result.level === "fail")) break
    reached = stage
  }
  return { slug, missing: false, results, reached }
}

const MARK = { ok: "✓", warn: "•", fail: "✗" }
const args = process.argv.slice(2)
const stageAt = args.indexOf("--stage")
const gate = stageAt >= 0 ? args[stageAt + 1] : null
if (gate !== null && !STAGES.includes(gate)) {
  console.error(`The stages are ${STAGES.join(", ")}, got ${gate ?? "nothing"}`)
  process.exit(2)
}

if (args.includes("--all")) {
  const slugs = ["template", ...registry().map((game) => game.slug).filter((slug) => slug !== "template")]
  const width = Math.max(...slugs.map((slug) => slug.length))
  for (const slug of slugs) {
    const done = check(slug)
    const next = done.results.find((result) => result.level === "fail")
    console.log(`${slug.padEnd(width)}  ${(done.reached ?? "nothing").padEnd(9)} ${next ? `next: ${next.stage}, ${next.name}: ${next.message}` : "every stage passes"}`)
  }
  process.exit(0)
}

const slug = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--stage")
if (!slug) {
  console.error("Usage: pnpm check:game <slug> [--stage <stage>] | pnpm check:game --all")
  process.exit(2)
}
const done = check(slug)
if (done.missing) {
  console.error(`There is no game ${slug}: games/${slug} does not exist. \`pnpm add-game\` makes one.`)
  process.exit(2)
}
const upTo = gate ? STAGES.indexOf(gate) : STAGES.length - 1
let failed = 0
for (const stage of STAGES) {
  const here = done.results.filter((result) => result.stage === stage)
  console.log(`\n${stage}${STAGES.indexOf(stage) > upTo ? " (beyond the gate)" : ""}`)
  for (const result of here) {
    console.log(`  ${MARK[result.level]} ${result.name}: ${result.message}`)
    if (result.level === "fail" && STAGES.indexOf(stage) <= upTo) failed++
  }
}
console.log(`\n${slug} has got as far as: ${done.reached ?? "nothing"}.${gate ? (failed ? ` Not ready for after ${gate}: ${failed} to fix.` : ` Ready for what follows ${gate}.`) : ""}`)
process.exit(gate && failed ? 1 : 0)

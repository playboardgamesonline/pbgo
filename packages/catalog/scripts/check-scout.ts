// `pnpm check:scout <file> [--online]` and `pnpm check:scout --list`: is a scout file (`.claude/skills/game-scout`) what `/add-game` reads? The shape, the slug and the name by the rules of
// `packages/games/src/scout.ts` and `slug.ts`; with `--online`, against what exists (no folder for the game yet, `existing.catalog` and the base game against the platform's published documents:
// public API, no token). `--list` prints what a scouted game is compared with. Run by Node, which strips the types, hence the `.ts` extensions below. Exit 0: sound; 1: the file or what exists
// says otherwise (or the project cannot be read); 2: a wrong command line.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { GAMES } from "@pbgo/games/registry"
import { readScout, stateProblems } from "@pbgo/games/scout"
import { describeState, readScoutState } from "../src/scout-state.ts"

const USAGE = `Usage: pnpm check:scout <file> [--online]
       pnpm check:scout --list

  <file>     a scout file, scout.json (a relative path is read from the folder the command was typed in)
  --online   also check it against what exists: the game has no folder yet (the registry), and existing.catalog and the base game agree with the published
             documents of the platform's Sanity project (the public API, no token). It is the state at the time of the scout: use it when the file is made, not after.
  --list     print the games and the expansions that a scouted game is compared with: slug, type, BoardGameGeek id, base game, folder in the repo and name
  --help     this text`

/** A wrong command line: reported with the usage, exit 2. */
class UsageError extends Error {}

function parse(argv: string[]): { help: boolean; online: boolean; list: boolean; file: string } {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options = { help: false, online: false, list: false, file: "" }
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--online") options.online = true
    else if (arg === "--list") options.list = true
    else if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}`)
    else if (options.file !== "") throw new UsageError(`One file only, got "${options.file}" and "${arg}"`)
    else options.file = arg
  }
  if (options.help) return options
  if (options.list && (options.file !== "" || options.online)) throw new UsageError("--list takes no file and no other option")
  if (!options.list && options.file === "") throw new UsageError("Give the scout file to check")
  return options
}

const list = (problems: string[]) => problems.map((problem) => `  - ${problem}`).join("\n")

try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
  } else if (options.list) {
    console.log(describeState(GAMES.map(({ slug, name }) => ({ slug, name })), await readScoutState()))
  } else {
    // pnpm runs the script from the root of the repo: the folder the command was typed in is INIT_CWD
    const path = resolve(process.env.INIT_CWD ?? process.cwd(), options.file)
    let content: string
    try {
      content = readFileSync(path, "utf8")
    } catch (error) {
      throw new UsageError(`Cannot read ${path} (${error instanceof Error && "code" in error ? String(error.code) : "unreadable"})`)
    }
    const { scout, problems } = readScout(content)
    if (scout === null) {
      console.log(`fail  ${path}\n${list(problems)}`)
      process.exitCode = 1
    } else if (!options.online) {
      console.log(`ok    ${path}: ${scout.name} (${scout.slug}, ${scout.type})`)
    } else {
      const state = { registry: GAMES.map((game) => game.slug), ...(await readScoutState()) }
      const found = stateProblems(scout, state)
      if (found.length > 0) {
        console.log(`fail  ${path}: ${scout.name} (${scout.slug}, ${scout.type}), against the registry and the catalog\n${list(found)}`)
        process.exitCode = 1
      } else {
        console.log(`ok    ${path}: ${scout.name} (${scout.slug}, ${scout.type}), against the registry and the catalog`)
      }
    }
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof UsageError) {
    console.error(`\n${USAGE}`)
    process.exitCode = 2
  } else {
    process.exitCode = 1
  }
}

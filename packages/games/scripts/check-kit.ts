// `pnpm check:kit [<name or file>] [--json]`: what the boards of the games reach of the shared kit, `@pbgo/table`, from the source of this checkout (`packages/games/src/board-kit.ts`, the one reading that `pnpm check:game`
// and the tests of the boards use). Without an argument, the files of the kit by who loads them: every board, some of them, none. With a name the kit gives out (`Card`) or a file of it (`card/card.tsx`), the boards that an
// edit of it changes, and the ones it leaves as they are: the question to ask before a change of the kit. It reads files and nothing else. Run by Node, which strips the types, hence the `.ts` extensions below. Exit 0;
// 2 for a wrong command line or a name that is not the kit's.
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { kitExports, kitFiles, KIT_DIR, readBoards, reachedBy } from "../src/board-kit.ts"

const USAGE = `Usage: pnpm check:kit [<name or file>] [--json]

  (nothing)    the files of @pbgo/table by the boards that load them: every board, some, none
  <name>       an export of the kit (Card): the boards an edit of the file that holds it changes
  <file>       a file of the kit (card/card.tsx, or its path from the root): the same
  --json       one line of JSON instead of the text
  --help       this text`

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const SHORT = `${KIT_DIR}/`

/** A wrong command line, or a name that the kit does not give out: reported with the usage, exit 2. */
class UsageError extends Error {}

/** The folder of a file of the kit and its name: `card/card.tsx` is `card` and `card.tsx`, and a file at the root of the kit has an empty folder. */
const split = (file: string): [string, string] => {
  const short = file.slice(SHORT.length)
  const at = short.lastIndexOf("/")
  return at < 0 ? ["", short] : [short.slice(0, at), short.slice(at + 1)]
}

/** The file of the kit a name or a path means, as a path from the root. */
function fileOf(what: string, files: string[], exported: Map<string, string>): string {
  const given = exported.get(what)
  if (given) return given.slice(REPO.length).split("\\").join("/")
  const short = what.startsWith(SHORT) ? what.slice(SHORT.length) : what
  const matches = files.filter((file) => file.slice(SHORT.length) === short || file.slice(SHORT.length).endsWith(`/${short}`))
  if (matches.length === 1) return matches[0]!
  if (matches.length > 1) throw new UsageError(`${what} is in several files of the kit: ${matches.map((file) => file.slice(SHORT.length)).join(", ")}`)
  throw new UsageError(`${what} is neither a name the kit gives out nor a file of it (${SHORT.slice(0, -1)})`)
}

/** Groups the files of one list by folder, one line each: `card/  card.tsx, flight.ts`. */
function byFolder(files: string[]): string[] {
  const folders = new Map<string, string[]>()
  for (const file of files) {
    const [folder, name] = split(file)
    folders.set(folder, [...(folders.get(folder) ?? []), name])
  }
  const width = Math.max(0, ...[...folders.keys()].map((folder) => (folder ? folder.length + 1 : 0)))
  return [...folders.entries()].map(([folder, names]) => `  ${(folder ? `${folder}/` : "").padEnd(width)}  ${names.join(", ")}`)
}

function main(argv: string[]) {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const json = args.includes("--json")
  if (args.includes("--help") || args.includes("-h")) return console.log(USAGE)
  const unknown = args.filter((arg) => arg.startsWith("-") && !["--json", "--help", "-h"].includes(arg))
  if (unknown.length > 0) throw new UsageError(`Not an option: ${unknown.join(" ")}`)
  const asked = args.filter((arg) => !arg.startsWith("-"))
  if (asked.length > 1) throw new UsageError("One name or one file at a time")

  const boards = readBoards(REPO, ["template", ...readdirSync(join(REPO, "games"))])
  const slugs = boards.map((board) => board.slug)
  const files = kitFiles(REPO)
  if (asked[0] !== undefined) {
    const file = fileOf(asked[0], files, kitExports(REPO))
    const reaches = reachedBy(boards, file)
    const misses = slugs.filter((slug) => !reaches.includes(slug))
    if (json) return console.log(JSON.stringify({ file, reaches, misses }))
    const [folder, name] = split(file)
    console.log(`${folder ? `${folder}/` : ""}${name} of the kit: an edit of it changes ${reaches.length === 0 ? "no board" : reaches.length === slugs.length ? `every board (${reaches.join(", ")})` : `${reaches.join(", ")}`}${misses.length > 0 && reaches.length > 0 ? `, and leaves ${misses.join(", ")} as it is` : ""}.`)
    return
  }

  const reach = files.map((file) => ({ file, boards: reachedBy(boards, file) }))
  const every = reach.filter((row) => row.boards.length === slugs.length).map((row) => row.file)
  const none = reach.filter((row) => row.boards.length === 0).map((row) => row.file)
  const some = reach.filter((row) => row.boards.length > 0 && row.boards.length < slugs.length)
  if (json) return console.log(JSON.stringify({ boards: slugs, every, some, none }))
  console.log(`@pbgo/table: ${files.length} files, read through the boards of ${slugs.length} games (${slugs.join(", ")}).`)
  console.log(`\nLoaded by every board (${every.length})`)
  console.log(byFolder(every).join("\n"))
  console.log(`\nLoaded by some boards (${some.length})`)
  const width = Math.max(0, ...some.map((row) => row.file.length - SHORT.length))
  for (const row of some) console.log(`  ${row.file.slice(SHORT.length).padEnd(width)}  ${row.boards.join(", ")}`)
  console.log(`\nLoaded by no board (${none.length}): pieces for the games to come, or code a board no longer needs`)
  console.log(byFolder(none).join("\n"))
}

try {
  main(process.argv.slice(2))
} catch (error) {
  if (!(error instanceof UsageError)) throw error
  console.error(`${error.message}\n\n${USAGE}`)
  process.exit(2)
}

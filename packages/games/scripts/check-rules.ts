// `pnpm check:rules <slug> [--name "<Game Name>"] [--stamp [--date YYYY-MM-DD]]`: is the spec of a game (`.claude/skills/game-rules-spec`) what `/add-game` and the engine read? Its page, `docs/games/<slug>/rules.md`,
// by the shape of `packages/games/src/rules-spec.ts` (the sections, the table of the components, the open points, the pages cited), and its landing page, `docs/games/<slug>/index.md`, which
// the docs of the site need for the folder. With `--name`, the title of the page is that game's. With `--stamp`, a spec that passes is stamped as validated (what the owner's ok does: its status and
// every reading that waited for their word become "validated" with the day). Run by Node, which strips the types, hence the `.ts` extensions below. Exit 0: sound; 1: the spec says otherwise (or is
// not there); 2: a wrong command line. `PBGO_GAMES_DOCS_DIR` moves the folder of the specs (a test's temporary world); it is `docs/games` of this checkout.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describeSpec, indexProblems, readRulesSpec, specPathsOf, stampValidated } from "../src/rules-spec.ts"
import { SLUG_PATTERN, slugProblem } from "../src/slug.ts"

const USAGE = `Usage: pnpm check:rules <slug> [--name "<Game Name>"] [--stamp [--date YYYY-MM-DD]]

  <slug>     the game, as its folder of the docs is named: docs/games/<slug>/rules.md and index.md are checked
  --name     the name of the game: the title of the page is "<name>: rules spec" and the one of the landing page "<name>"
  --stamp    when both pages pass, stamp the spec as validated: its status and every open point that waits for the owner become "validated <day>"
  --date     the day of the stamp (default: today)
  --help     this text`

/** A wrong command line: reported with the usage, exit 2. */
class UsageError extends Error {}

type Options = { help: boolean; slug: string; name: string | undefined; stamp: boolean; date: string | undefined }

function parse(argv: string[]): Options {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: Options = { help: false, slug: "", name: undefined, stamp: false, date: undefined }
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at] ?? ""
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--stamp") options.stamp = true
    else if (arg === "--name") {
      const value = args[at + 1]
      if (value === undefined || value.startsWith("-") || value.trim() === "") throw new UsageError("--name takes the name of the game")
      options.name = value
      at += 1
    } else if (arg === "--date") {
      const value = args[at + 1]
      if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new UsageError("--date takes a day, YYYY-MM-DD")
      options.date = value
      at += 1
    } else if (arg.startsWith("-")) throw new UsageError(`Unknown option ${arg}`)
    else if (options.slug !== "") throw new UsageError(`One game only, got "${options.slug}" and "${arg}"`)
    else options.slug = arg
  }
  if (options.help) return options
  if (options.slug === "") throw new UsageError("Give the slug of the game")
  if (!SLUG_PATTERN.test(options.slug)) throw new UsageError(slugProblem(options.slug) ?? `"${options.slug}" is not a slug`)
  if (options.date !== undefined && !options.stamp) throw new UsageError("--date goes with --stamp")
  return options
}

const list = (problems: string[]) => problems.map((problem) => `  - ${problem}`).join("\n")

function read(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null
}

/** The day, as this machine's clock says it (`YYYY-MM-DD`). */
function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(USAGE)
  } else {
    const root = process.env.PBGO_GAMES_DOCS_DIR ?? join(fileURLToPath(new URL("../../..", import.meta.url)), "docs", "games")
    const files = specPathsOf(root, options.slug)
    const shown = specPathsOf("docs/games", options.slug)
    const rules = read(files.rules)
    const index = read(files.index)
    let failed = false
    let pageSound = false
    if (rules === null) {
      console.log(`fail  ${shown.rules}\n  - the file is not there: \`game-rules-spec\` writes it`)
      failed = true
    } else {
      const { spec, problems } = readRulesSpec(rules)
      const named = options.name !== undefined && spec !== null && spec.name !== options.name ? [`the title says "${spec.name}", the game is "${options.name}"`] : []
      if (spec === null || named.length > 0) {
        console.log(`fail  ${shown.rules}\n${list([...problems, ...named])}`)
        failed = true
      } else {
        console.log(`ok    ${shown.rules}: ${describeSpec(spec)}`)
        pageSound = true
      }
    }
    if (index === null) {
      console.log(`fail  ${shown.index}\n  - the file is not there: the docs of the site need a landing page for the folder`)
      failed = true
    } else {
      const problems = indexProblems(index, options.name)
      if (problems.length > 0) {
        console.log(`fail  ${shown.index}\n${list(problems)}`)
        failed = true
      } else {
        console.log(`ok    ${shown.index}`)
      }
    }
    // the owner's ok: a spec that passes is stamped, and only if the stamped page passes too (a page that is validated already is left as it is)
    if (options.stamp && !failed && pageSound && rules !== null) {
      const day = options.date ?? today()
      const stamped = stampValidated(rules, day)
      if (stamped === rules) {
        console.log(`stamp ${shown.rules}: it is validated already, nothing changed`)
      } else {
        const again = readRulesSpec(stamped)
        if (again.spec === null) {
          console.log(`fail  ${shown.rules}\n  - stamping the validation would leave a page that does not pass the check: nothing was changed\n${list(again.problems)}`)
          failed = true
        } else {
          writeFileSync(files.rules, stamped)
          console.log(`stamp ${shown.rules}: ${describeSpec(again.spec)}`)
        }
      }
    }
    if (failed) process.exitCode = 1
  }
} catch (error) {
  if (!(error instanceof UsageError)) throw error
  console.error(`${error.message}\n\n${USAGE}`)
  process.exitCode = 2
}

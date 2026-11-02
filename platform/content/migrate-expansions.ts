// Moves the expansions that were made as games (a `game` of kind "expansion") to the `expansion` type of the Studio: PLT-102.
// Usage and guarantees: `node content/migrate-expansions.ts --help`, docs/platform-sanity.md.
import { readToken } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { describePlan, migrate } from "./migration/expansions.ts"
import { createHttpStore } from "./migration/http-store.ts"

const HELP = `Moves the expansions made as games (a game of kind "expansion") to the expansion type, as drafts: for each one it creates
drafts.expansion-<slug> and deletes the game draft, in one transaction. Nothing is published.

Usage: node content/migrate-expansions.ts [options]

  --dry-run   Read the dataset and print exactly what would change. Writes nothing. This is the default.
  --apply     Write it, in one transaction, then read the dataset back. Only on the owner's word.
  --help, -h  This text

It moves drafts only, and stops without writing anything on what it could not move without losing or guessing: a published game of that
kind, a field an expansion has no place for, a draft with no base game, a reference to a document that is not there, an expansion that
exists already. The Studio with the expansion type should be deployed first, to see the result.
The write token is read from SANITY_API_WRITE_TOKEN_PLATFORM in the environment, else from apps/web/.env.local. It is never printed.`

/** A wrong command line: reported with a hint, not with a stack trace. */
class UsageError extends Error {}

function parse(argv: string[]): { help: boolean; apply: boolean } {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options = { help: false, apply: false }
  let dryRun = false
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--apply") options.apply = true
    else if (arg === "--dry-run") dryRun = true
    else throw new UsageError(arg.startsWith("-") ? `Unknown option ${arg}` : `Unexpected argument "${arg}"`)
  }
  if (options.apply && dryRun) throw new UsageError("--apply and --dry-run exclude each other")
  return options
}

let token = ""
try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
  } else {
    token = readToken({ slug: SLUG, envFile: ENV_FILE })
    const outcome = await migrate(createHttpStore({ projectId: PROJECT_ID, dataset: DATASET, token }), { apply: options.apply })
    console.log(describePlan(outcome.plan, { projectId: PROJECT_ID, dataset: DATASET, mode: outcome.mode }))
    if (outcome.afterProblems.length > 0) console.error(`\nThe write is not what the plan said:\n${outcome.afterProblems.map((problem) => `  - ${problem}`).join("\n")}`)
    // A plan that cannot run is a failure, whether or not --apply was asked
    if (outcome.plan.problems.length > 0 || outcome.afterProblems.length > 0) process.exitCode = 1
  }
} catch (error) {
  // Only the message, and never the token, even if a library echoes it
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${token ? message.split(token).join("[token]") : message}`)
  if (error instanceof UsageError) console.error("Run with --help for the options.")
  process.exitCode = 1
}

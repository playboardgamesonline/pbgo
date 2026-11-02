// Converts the texts and pictures of the catalog to the translated fields of the Studio: PLT-104.
// Usage and guarantees: `node content/migrate-translations.ts --help`, docs/platform-sanity.md.
import { readToken } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { createTranslationStore } from "./migration/http-store.ts"
import { createSnapshotStore } from "./migration/snapshot-store.ts"
import { describePlan, migrate } from "./migration/translations.ts"

const HELP = `Converts the games, the expansions and the categories to the translated fields of the Studio (PLT-104): a text and a picture
become the row of English of their field, rulesFr, rulesEn, rulesEs and rulesDe become the rows of rules, and every translated
field gets its row of English, empty if need be (so that opening a published document in the Studio writes nothing). The published
documents and the drafts are patched in place, in one transaction. Nothing is published. Running it again does nothing.

Usage: node content/migrate-translations.ts [options]

  --dry-run      Read the dataset and print what would change, field by field. Writes nothing. This is the default.
  --apply        Write it, in one transaction, then read the dataset back. Only on the owner's word, after a backup:
                 from platform/apps/studio, pnpm exec sanity dataset export production <folder>/backup.tar.gz
  --from <file>  Plan against a file of documents instead of the dataset: a JSON array, the answer of the query API ({ "result": [...] })
                 or the data.ndjson of an export. Always a dry run, and needs no token.
  --verbose, -v  Say it for each document
  --show <id>    Print the patch of that document as it would be sent (a draft's id starts with drafts.)
  --help, -h     This text

It stops without writing anything on what it could not convert without losing or guessing: a field that holds neither rows nor the old
value, a row of a language the platform does not have, two rows of one language, two links for one language, a document in a release.
Run it after the Studio with the translated fields is deployed, with the documents closed in the Studio, and before the seed.
The write token is read from SANITY_API_WRITE_TOKEN_PLATFORM in the environment, else from apps/web/.env.local. It is never printed.`

/** A wrong command line: reported with a hint, not with a stack trace. */
class UsageError extends Error {}

type Options = { help: boolean; apply: boolean; verbose: boolean; from?: string; show?: string }

function parse(argv: string[]): Options {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: Options = { help: false, apply: false, verbose: false }
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--apply") options.apply = true
    else if (arg === "--dry-run") dryRun = true
    else if (arg === "--verbose" || arg === "-v") options.verbose = true
    else if (arg === "--from") {
      const file = args[++i]
      if (!file || file.startsWith("-")) throw new UsageError("--from needs the file to read")
      options.from = file
    } else if (arg === "--show") {
      const id = args[++i]
      if (!id || id.startsWith("-")) throw new UsageError("--show needs the id of the document")
      options.show = id
    } else throw new UsageError(arg.startsWith("-") ? `Unknown option ${arg}` : `Unexpected argument "${arg}"`)
  }
  if (options.apply && dryRun) throw new UsageError("--apply and --dry-run exclude each other")
  if (options.apply && options.from) throw new UsageError("--from reads a file, which is never written: it makes a dry run, --apply needs the dataset")
  return options
}

let token = ""
try {
  const options = parse(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
  } else {
    const store = options.from ? createSnapshotStore(options.from) : createTranslationStore({ projectId: PROJECT_ID, dataset: DATASET, token: (token = readToken({ slug: SLUG, envFile: ENV_FILE })) })
    const outcome = await migrate(store, { apply: options.apply })
    console.log(describePlan(outcome.plan, { projectId: PROJECT_ID, dataset: DATASET, mode: outcome.mode, source: options.from, verbose: options.verbose, show: options.show }))
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

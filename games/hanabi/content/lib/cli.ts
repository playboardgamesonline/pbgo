export type CliOptions = {
  apply: boolean
  overwrite: boolean
  only: string[]
  artDir?: string
  verbose: boolean
  help: boolean
}

/** A wrong command line: reported with the usage, not with a stack trace. */
export class UsageError extends Error {}

export const HELP = `Seeds the game's Sanity content as DRAFTS (cards, rules, credits, art). Safe to run again.

Usage: node content/seed.ts [options]

  --dry-run          Read the dataset and print what would happen. Writes nothing. This is the default.
  --apply            Write the drafts (and upload the art given with --art-dir). Publishing stays a Studio action.
  --art-dir <dir>    Normalize the images of this folder (WebP) and place them. Without it the art is left alone.
  --only <a,b>       Limit the run to documents, by id or by type (repeatable): --only rules,settings
  --overwrite        Replace values edited in the Studio with the seed's (needs --only). Without it they are kept.
  --verbose, -v      List every document, not only the ones that change
  --help, -h         This text

The write token is read from SANITY_API_WRITE_TOKEN_<SLUG> in the environment, else from apps/web/.env.local. It is never printed.`

const FLAGS_WITH_VALUE = new Set(["--art-dir", "--only"])

/** `process.argv.slice(2)` in, options out. A leading `--` (pnpm forwarding) is ignored. */
export function parseCli(argv: string[]): CliOptions {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const options: CliOptions = { apply: false, overwrite: false, only: [], verbose: false, help: false }
  let dryRun = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? ""
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    let value: string | undefined = eq > 0 ? arg.slice(eq + 1) : undefined
    if (FLAGS_WITH_VALUE.has(flag) && value === undefined) {
      value = args[i + 1]
      i += 1
    }
    if (FLAGS_WITH_VALUE.has(flag) && (!value || value.startsWith("-"))) throw new UsageError(`${flag} needs a value`)

    switch (flag) {
      case "--apply":
        options.apply = true
        break
      case "--dry-run":
        dryRun = true
        break
      case "--overwrite":
        options.overwrite = true
        break
      case "--verbose":
      case "-v":
        options.verbose = true
        break
      case "--help":
      case "-h":
        options.help = true
        break
      case "--art-dir":
        options.artDir = value
        break
      case "--only":
        options.only.push(...(value ?? "").split(",").map((token) => token.trim()).filter(Boolean))
        break
      default:
        throw new UsageError(flag.startsWith("-") ? `Unknown option ${flag}` : `Unexpected argument "${arg}"`)
    }
  }

  if (options.apply && dryRun) throw new UsageError("--apply and --dry-run exclude each other")
  if (options.overwrite && !options.only.length && !options.help) throw new UsageError("--overwrite replaces what was edited in the Studio: say which documents with --only")
  return options
}

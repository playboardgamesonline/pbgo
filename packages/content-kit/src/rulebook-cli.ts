import { resolve } from "node:path"
import { apiVersion, isProjectId } from "@pbgo/core/sanity/env.ts"
import { UsageError } from "./cli.ts"
import { readToken } from "./env.ts"
import { formatRulebookList, formatRulebookReport, loadRulebooks, parseRulebookArgs, placeRulebooks } from "./rulebook.ts"
import type { RulebookInput } from "./rulebook.ts"
import { connect } from "./store.ts"

export const RULEBOOK_HELP = `Places a game's rulebooks (PDF, one per language) in the draft of its Settings in Sanity. Safe to run again.

Usage: node packages/content-kit/src/rulebook-bin.ts <command> [options]

Commands
  check   Read the PDFs and say what they are. Nothing is sent anywhere, no token is needed.
  place   Put them in the Studio fields "Rules PDF (FR|EN|ES|DE)" of the draft of Settings. A dry run unless --apply.

Options
  --rules [<lang>=]<file>  A rulebook (repeatable, one per language): --rules fr=regles.pdf --rules en=rules.pdf. Without a language it is English.
  --from <dir>             The folder relative paths are read from. Default: the current folder.
  --slug <slug>            place: the game, whose write token SANITY_API_WRITE_TOKEN_<SLUG> is used.
  --project <id>           place: the game's Sanity project id.
  --dataset <name>         place: its dataset. Default: production.
  --env-file <file>        place: where the token is looked for when the environment has none. Default: apps/web/.env.local.
  --dry-run                place: read the dataset and print what would happen. Writes nothing. This is the default.
  --apply                  place: upload the files and write the draft. Publishing stays a Studio action.
  --overwrite              place: replace a file a field already holds. Without it the field keeps its file.
  --help, -h               This text

The write token is read from SANITY_API_WRITE_TOKEN_<SLUG> in the environment, else from the env file. It is never printed.`

/** What the command line asks for. `check` only reads the files; `place` also says where they go. */
export type RulebookCommandLine =
  | { command: "help" }
  | { command: "check"; rules: RulebookInput[]; from?: string }
  | { command: "place"; rules: RulebookInput[]; from?: string; slug: string; projectId: string; dataset: string; envFile: string; apply: boolean; overwrite: boolean }

const FLAGS_WITH_VALUE = new Set(["--rules", "--from", "--slug", "--project", "--dataset", "--env-file"])

/** The flags `check` has no use for: it sends nothing, so saying where or how to send would only mislead. */
const PLACE_ONLY = new Set(["--slug", "--project", "--dataset", "--env-file", "--apply", "--dry-run", "--overwrite"])

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATASET = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** `process.argv.slice(2)` in, the command line out. A leading `--` (pnpm forwarding) is ignored. */
export function parseRulebookCli(argv: string[]): RulebookCommandLine {
  const args = argv[0] === "--" ? argv.slice(1) : argv
  const values = new Map<string, string>()
  const rules: string[] = []
  const placeOnly: string[] = []
  const positional: string[] = []
  let apply = false
  let dryRun = false
  let overwrite = false
  let help = false

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? ""
    const eq = arg.startsWith("--") ? arg.indexOf("=") : -1
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    let value: string | undefined = eq > 0 ? arg.slice(eq + 1) : undefined
    if (FLAGS_WITH_VALUE.has(flag)) {
      if (value === undefined) {
        value = args[i + 1]
        i += 1
      }
      if (!value || value.startsWith("-")) throw new UsageError(`${flag} needs a value`)
    }
    if (PLACE_ONLY.has(flag)) placeOnly.push(flag)

    switch (flag) {
      case "--rules":
        rules.push(value ?? "")
        break
      case "--from":
      case "--slug":
      case "--project":
      case "--dataset":
      case "--env-file":
        if (values.has(flag)) throw new UsageError(`${flag} is given twice`)
        values.set(flag, value ?? "")
        break
      case "--apply":
        apply = true
        break
      case "--dry-run":
        dryRun = true
        break
      case "--overwrite":
        overwrite = true
        break
      case "--help":
      case "-h":
        help = true
        break
      default:
        if (flag.startsWith("-")) throw new UsageError(`Unknown option ${flag}`)
        positional.push(arg)
    }
  }

  if (help) return { command: "help" }
  const [command, ...extra] = positional
  if (!command) throw new UsageError("Say what to do: check (read the PDFs) or place (put them in Sanity)")
  if (extra.length) throw new UsageError(`Unexpected argument "${extra[0]}"`)
  if (command !== "check" && command !== "place") throw new UsageError(`Unknown command "${command}": check or place`)
  if (apply && dryRun) throw new UsageError("--apply and --dry-run exclude each other")
  if (!rules.length) throw new UsageError("No rulebook given: --rules [<language>=]<file.pdf>")

  const inputs = parseRulebookArgs(rules)
  const from = values.get("--from")

  if (command === "check") {
    const [first] = placeOnly
    if (first) throw new UsageError(`${first} is for place: check only reads the files and sends nothing`)
    return { command, rules: inputs, from }
  }

  const slug = values.get("--slug")
  if (!slug) throw new UsageError("place needs the game: --slug <slug>")
  if (!SLUG.test(slug)) throw new UsageError(`"${slug}" is not a game slug (lowercase letters, digits and dashes)`)
  const projectId = values.get("--project")
  if (!projectId) throw new UsageError("place needs the Sanity project of the game: --project <id>")
  if (!isProjectId(projectId)) throw new UsageError(`"${projectId}" is not a Sanity project id (lowercase letters, digits and dashes)`)
  const dataset = values.get("--dataset") ?? "production"
  if (!DATASET.test(dataset)) throw new UsageError(`"${dataset}" is not a Sanity dataset name`)
  return { command, rules: inputs, from, slug, projectId, dataset, envFile: values.get("--env-file") ?? "apps/web/.env.local", apply, overwrite }
}

/** What the command needs from the outside. Tests pass their own; the real ones are the defaults. */
export type RulebookCliDeps = {
  /** Where a relative path is read from */
  cwd: string
  readToken: typeof readToken
  connect: typeof connect
  log: (text: string) => void
  error: (text: string) => void
}

/**
 * The command of the rulebooks (`node packages/content-kit/src/rulebook-bin.ts check|place …`): reads the PDFs, then either lists them or
 * places them in Sanity. Returns the exit code instead of setting it, so that a test can call it. An error prints its message only
 * (never the token, even if a library echoes it) and gives a failure code.
 */
export async function runRulebookCli(argv: string[] = process.argv.slice(2), deps: Partial<RulebookCliDeps> = {}): Promise<number> {
  const { cwd = process.cwd(), log = console.log, error = console.error } = deps
  const tokenOf = deps.readToken ?? readToken
  const open = deps.connect ?? connect
  let token = ""
  try {
    const line = parseRulebookCli(argv)
    if (line.command === "help") {
      log(RULEBOOK_HELP)
      return 0
    }
    const rulebooks = await loadRulebooks(line.rules, { cwd: line.from ? resolve(cwd, line.from) : cwd })
    if (line.command === "check") {
      log(formatRulebookList(rulebooks))
      return 0
    }
    token = tokenOf({ slug: line.slug, envFile: resolve(cwd, line.envFile) })
    const store = open({ projectId: line.projectId, dataset: line.dataset, apiVersion, token })
    const result = await placeRulebooks({ store, rulebooks, apply: line.apply, overwrite: line.overwrite })
    log(formatRulebookReport(result, { projectId: line.projectId, dataset: line.dataset }))
    return 0
  } catch (cause) {
    // Only the message, and never the token, even if a library echoes it
    const message = cause instanceof Error ? cause.message : String(cause)
    error(`Error: ${token ? message.split(token).join("[token]") : message}`)
    if (cause instanceof UsageError) error("Run with --help for the options.")
    return 1
  }
}

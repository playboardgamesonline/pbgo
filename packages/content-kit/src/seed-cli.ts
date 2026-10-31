import { apiVersion } from "@pbgo/core/sanity/env.ts"
import type { ArtSlot } from "./art.ts"
import { HELP, parseCli, UsageError } from "./cli.ts"
import { readToken } from "./env.ts"
import { formatReport } from "./report.ts"
import { run } from "./run.ts"
import { connect } from "./store.ts"
import type { SeedDoc } from "./types.ts"

/** The documents of a seed and the art slots they have. */
export type SeedContent = { docs: SeedDoc[]; slots: ArtSlot[] }

/**
 * What a game hands to the pipeline: the dataset its content goes to, and the content. Written down in the code (`docs`, `slots`), or
 * read from somewhere and so built when it is asked for (`content`: the platform's seed reads Notion, which is async and tells which
 * pictures there are, so its slots come out of the same read as its documents).
 */
export type SeedConfig = {
  slug: string
  projectId: string
  /** Fixed by the game on purpose: an exported `NEXT_PUBLIC_SANITY_DATASET` must not redirect the writes */
  dataset: string
  /** The git-ignored env file that holds `SANITY_API_WRITE_TOKEN_<SLUG>` when the environment does not */
  envFile: string
} & (
  | {
      /** Builds every document of the seed; called after the options are checked and the token is read, so `--help` and a wrong option never build the data */
      docs: () => SeedDoc[]
      slots: ArtSlot[]
    }
  | {
      /** Builds the documents and the slots together, when it is asked for like `docs` is (after the options and the token) */
      content: () => SeedContent | Promise<SeedContent>
    }
)

/**
 * The command of a game (`node content/seed.ts [options]`): reads the options, the token and the content, runs the seed and prints the report.
 * An error prints its message only (never the token, even if a library echoes it) and sets a failure exit code.
 */
export async function runSeedCli(config: SeedConfig, argv: string[] = process.argv.slice(2)): Promise<void> {
  let token = ""
  try {
    const cli = parseCli(argv)
    if (cli.help) {
      console.log(HELP)
      return
    }
    token = readToken({ slug: config.slug, envFile: config.envFile })
    const store = connect({ projectId: config.projectId, dataset: config.dataset, apiVersion, token })
    const { docs, slots } = "content" in config ? await config.content() : { docs: config.docs(), slots: config.slots }
    const result = await run({
      store,
      docs,
      slots,
      options: { apply: cli.apply, overwrite: cli.overwrite, only: cli.only, artDir: cli.artDir },
    })
    console.log(formatReport(result, { projectId: config.projectId, dataset: config.dataset, verbose: cli.verbose }))
  } catch (error) {
    // Only the message, and never the token, even if a library echoes it
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${token ? message.split(token).join("[token]") : message}`)
    if (error instanceof UsageError) console.error("Run with --help for the options.")
    process.exitCode = 1
  }
}

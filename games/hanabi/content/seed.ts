// Seeds the Hanabi content in Sanity as drafts. Usage and guarantees: `node content/seed.ts --help`, docs/content-pipeline.md.
import { apiVersion, DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { ART_SLOTS } from "./data/art-manifest.ts"
import { buildSeedDocs } from "./data/index.ts"
import { HELP, parseCli, UsageError } from "./lib/cli.ts"
import { readToken } from "./lib/env.ts"
import { formatReport } from "./lib/report.ts"
import { run } from "./lib/run.ts"
import { connect } from "./lib/store.ts"

async function main(): Promise<void> {
  let token = ""
  try {
    const cli = parseCli(process.argv.slice(2))
    if (cli.help) {
      console.log(HELP)
      return
    }
    token = readToken({ slug: SLUG, envFile: ENV_FILE })
    const store = connect({ projectId: PROJECT_ID, dataset: DATASET, apiVersion, token })
    const result = await run({
      store,
      docs: buildSeedDocs(),
      slots: ART_SLOTS,
      options: { apply: cli.apply, overwrite: cli.overwrite, only: cli.only, artDir: cli.artDir },
    })
    console.log(formatReport(result, { projectId: PROJECT_ID, dataset: DATASET, verbose: cli.verbose }))
  } catch (error) {
    // Only the message, and never the token, even if a library echoes it
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${token ? message.split(token).join("[token]") : message}`)
    if (error instanceof UsageError) console.error("Run with --help for the options.")
    process.exitCode = 1
  }
}

await main()

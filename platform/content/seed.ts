// Seeds the platform's catalog in Sanity as drafts: the games of the Notion Games database as the hub lists them, with the people,
// publishers and categories they point at. Usage and guarantees: `node content/seed.ts --help`, docs/platform-sanity.md.
import { runSeedCli } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { buildSeedContent } from "./data/index.ts"
import { notionOptions, readSource } from "./notion.ts"

await runSeedCli({
  slug: SLUG,
  projectId: PROJECT_ID,
  dataset: DATASET,
  envFile: ENV_FILE,
  // Built when the pipeline asks, after the options are checked and the token is read: `--help` never goes to Notion
  content: async () => {
    const { games, publishers, notes } = await readSource(notionOptions())
    console.log(notes.join("\n"), "\n")
    return buildSeedContent({ games, publishers })
  },
})

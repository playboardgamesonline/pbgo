// Seeds the platform's catalog in Sanity as drafts: the games of the Notion Games database as the hub lists them, with the people,
// publishers and categories they point at. Usage and guarantees: `node content/seed.ts --help`, docs/platform-sanity.md.
import { runSeedCli } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { buildSeedContent } from "./data/index.ts"
import { missingEnglish } from "./data/translated.ts"
import { notionOptions, readSource } from "./notion.ts"

await runSeedCli({
  slug: SLUG,
  projectId: PROJECT_ID,
  dataset: DATASET,
  envFile: ENV_FILE,
  // Built when the pipeline asks, after the options are checked and the token is read: `--help` never goes to Notion
  content: async () => {
    const { games, publishers, notes } = await readSource(notionOptions())
    const content = buildSeedContent({ games, publishers })
    // English is what every language falls back on: a row that has a text in another language and none in English cannot be published as it is
    console.log([...notes, ...missingEnglish(content.docs).map((gap) => `no English  ${gap}`)].join("\n"), "\n")
    return content
  },
})

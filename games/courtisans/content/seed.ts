// Seeds the Courtisans translations in Sanity as drafts. Usage and guarantees: `node content/seed.ts --help`, docs/content-pipeline.md.
import { runSeedCli } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { buildSeedDocs } from "./data/index.ts"

// No art: the images of Courtisans are already in the Studio.
await runSeedCli({ slug: SLUG, projectId: PROJECT_ID, dataset: DATASET, envFile: ENV_FILE, docs: buildSeedDocs, slots: [] })

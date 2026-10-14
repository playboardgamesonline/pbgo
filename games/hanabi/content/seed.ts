// Seeds the Hanabi content in Sanity as drafts. Usage and guarantees: `node content/seed.ts --help`, docs/content-pipeline.md.
import { runSeedCli } from "@pbgo/content-kit/seed"
import { DATASET, ENV_FILE, PROJECT_ID, SLUG } from "./config.ts"
import { ART_SLOTS } from "./data/art-manifest.ts"
import { buildSeedDocs } from "./data/index.ts"

await runSeedCli({ slug: SLUG, projectId: PROJECT_ID, dataset: DATASET, envFile: ENV_FILE, docs: buildSeedDocs, slots: ART_SLOTS })

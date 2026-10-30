import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The project this folder seeds, and the one dataset it writes to: the platform's own Sanity project (`playboardgamesonline`), not a game's.
 * `data/data.test.ts` checks that the project id is the one of its Studio (`apps/studio/sanity.cli.ts`).
 * The dataset is fixed on purpose: an exported `NEXT_PUBLIC_SANITY_DATASET` must not redirect the writes.
 * `SLUG` names the write token, `SANITY_API_WRITE_TOKEN_PLATFORM`.
 */
export const SLUG = "platform"
export const PROJECT_ID = "mhgqs6fe"
export const DATASET = "production"

export const CONTENT_DIR = dirname(fileURLToPath(import.meta.url))
export const PLATFORM_DIR = resolve(CONTENT_DIR, "..")
export const REPO_ROOT = resolve(PLATFORM_DIR, "..")

/** Where the write token and the Notion token live (git-ignored). */
export const ENV_FILE = resolve(REPO_ROOT, "apps/web/.env.local")

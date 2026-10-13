import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The game this folder seeds, and the one dataset it writes to.
 * The project id is also `sanityProjectId` in `packages/games/src/registry.ts`: this folder cannot import the registry (it depends on
 * the game package, which would loop back here), so `data/data.test.ts` checks that both agree.
 * The dataset is fixed on purpose: an exported `NEXT_PUBLIC_SANITY_DATASET` must not redirect the writes.
 */
export const SLUG = "exploding-kittens"
export const PROJECT_ID = "gsfz20b9"
export const DATASET = "production"

export const CONTENT_DIR = dirname(fileURLToPath(import.meta.url))
export const GAME_DIR = resolve(CONTENT_DIR, "..")
export const REPO_ROOT = resolve(GAME_DIR, "../..")

/** Where the write token lives (git-ignored). */
export const ENV_FILE = resolve(REPO_ROOT, "apps/web/.env.local")

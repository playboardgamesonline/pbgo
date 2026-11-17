// Where things are. Everything is read from the environment, so that a test (or the owner) can move it: the folder of the games' working files and the folder of their rules specs.
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export type Env = Record<string, string | undefined>

/** The checkout this code runs from (packages/pipeline/src, three levels up): the skills and the scripts it runs are this checkout's. */
export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "")

/** The folder outside the repo where a game's working files live (`<root>/<slug>/scout.json`, `pipeline.json`, `rules.pdf`, its art): `PBGO_ASSETS_DIR`, else `~/Companies/PBGO/assets`. */
export function assetsRoot(env: Env = process.env): string {
  return env.PBGO_ASSETS_DIR ? env.PBGO_ASSETS_DIR : join(homedir(), "Companies", "PBGO", "assets")
}

/** The folder of the specs of the games, `docs/games` of the checkout: the one place of the repo that a step writes before the game has a folder (its `<slug>/rules.md` and `index.md`). A test's world moves it. */
export function gamesDocsRoot(env: Env = process.env): string {
  return env.PBGO_GAMES_DOCS_DIR ? env.PBGO_GAMES_DOCS_DIR : join(REPO_ROOT, "docs", "games")
}

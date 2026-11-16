// Where things are and how the headless steps are tuned. Everything is read from the environment, so that a test (or the owner) can move it:
// the folder of the games' working files, the `claude` that is run, the model and the budget of a call.
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export type Env = Record<string, string | undefined>

/** The checkout this code runs from (packages/pipeline/src, three levels up). The headless steps run from here: the skills they use are the project's. */
export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, "")

/** The folder outside the repo where a game's working files live (`<root>/<slug>/scout.json`, `pipeline.json`, its art later). */
export function assetsRoot(env: Env = process.env): string {
  return env.PBGO_ASSETS_DIR ? env.PBGO_ASSETS_DIR : join(homedir(), "Companies", "PBGO", "assets")
}

/** The `claude` that is run: the one on the PATH, unless a test says another. */
export function claudeBin(env: Env = process.env): string {
  return env.PBGO_CLAUDE_BIN ? env.PBGO_CLAUDE_BIN : "claude"
}

/** What the command that checks a scout file is: `pnpm check:scout` unless a test says another (it is run with the file and `--online`). */
export function checkScoutBin(env: Env = process.env): string | null {
  return env.PBGO_CHECK_SCOUT_BIN ? env.PBGO_CHECK_SCOUT_BIN : null
}

/** What the command that checks the spec of a game is: `pnpm check:rules` unless a test says another (it is run with the slug and `--name`). */
export function checkRulesBin(env: Env = process.env): string | null {
  return env.PBGO_CHECK_RULES_BIN ? env.PBGO_CHECK_RULES_BIN : null
}

/** What the command that reads the pictures of a published game is: `pnpm catalog:pictures` unless a test says another (it is run with the slug). */
export function checkPicturesBin(env: Env = process.env): string | null {
  return env.PBGO_CHECK_PICTURES_BIN ? env.PBGO_CHECK_PICTURES_BIN : null
}

/** The folder of the specs of the games, `docs/games` of the checkout: the one place of the repo a step writes (its `<slug>/rules.md` and `index.md`). A test's temporary world moves it. */
export function gamesDocsRoot(env: Env = process.env): string {
  return env.PBGO_GAMES_DOCS_DIR ? env.PBGO_GAMES_DOCS_DIR : join(REPO_ROOT, "docs", "games")
}

/** `PBGO_ADD_GAME_NO_DOWNLOAD=1`: the command fetches no file (the rulebook of a game). The owner who is offline, or a test, sets it. */
export function downloadsOff(env: Env = process.env): boolean {
  return env.PBGO_ADD_GAME_NO_DOWNLOAD === "1"
}

export type Tuning = { model: string; budgetUsd: number }

function number(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? Number.NaN : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** The model and the budget (dollars, for one call) of a step: `PBGO_ADD_GAME_MODEL` and `PBGO_ADD_GAME_BUDGET_USD`. */
export function stepTuning(env: Env = process.env): Tuning {
  return { model: env.PBGO_ADD_GAME_MODEL || "sonnet", budgetUsd: number(env.PBGO_ADD_GAME_BUDGET_USD, 3) }
}

/** The bookkeeping calls (Linear) are small and mechanical: a small model and a small budget. */
export function linearTuning(env: Env = process.env): Tuning {
  return { model: env.PBGO_ADD_GAME_LINEAR_MODEL || "haiku", budgetUsd: number(env.PBGO_ADD_GAME_LINEAR_BUDGET_USD, 0.3) }
}

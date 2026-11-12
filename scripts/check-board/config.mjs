// The game's own part of a board check: `games/<slug>/check-board.config.mjs` (`template/` for the template), an optional file whose default export says what only the game knows. Everything in it is optional; a game with no file is
// still checked as far as the platform's own parts allow (the board draws, the windows, a turn played by the engine, the end of the game, a reload, the start, a player away).
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

/** The keys of the config, with what each one is, so that a typo is told and not silently ignored */
export const CONFIG_KEYS = {
  players: "the counts of seats to check (default: the fewest, a middle count and the most of the registry, at most 12)",
  sizes: "the windows, as \"WIDTHxHEIGHT\" (default: the platform's nine; the first is the one every control must be reachable in)",
  options: "the game's options for the tables of the checks (a shorter game: `{ targetScore: 500 }`)",
  bot: "`({ state, me, seat, table }) => action | null`: what a seat does on its move, to play the table on; null leaves it to the engine's debug `turn`",
  warm: "how many moves are played before a reload or an absence, so that there is something on the table (default 6)",
  scenes: "`{ name: async (table) => void }`: the situations the windows are photographed in; the first is reached before the board opens (default: the viewer's move)",
  presses: "`{ plan, find, expect, max, budgetSeconds, bot }`: what the viewer presses and where (see docs/scripts.md)",
  scenarios: "`{ name: { run({ table, page, record, settle, sleep, seats }), record } }`: the cases that GAME.debug can rig, each recorded as frames",
  ignoreConsole: "patterns (RegExp or text) of console messages that are not a failure here",
}

/** The game's folder: `games/<slug>`, `template` for the template */
export const gameDir = (root, slug) => (slug === "template" ? join(root, "template") : join(root, "games", slug))

/** The registry's entry of a game, read as check-game reads it: the player range */
export function registryEntry(root, slug) {
  const text = readFileSync(join(root, "packages/games/src/registry.ts"), "utf8")
  for (const [, found, body] of text.matchAll(/\{\s*slug:\s*"([^"]+)"([\s\S]*?)\n {2}\}/g)) {
    if (found !== slug) continue
    const players = /players:\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/.exec(body)
    return { slug, min: players ? Number(players[1]) : 2, max: players ? Number(players[2]) : 2 }
  }
  return null
}

const isObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)

/** Loads the game's config. `{ file, shown, config, problems }`: no file is an empty config, a wrong shape is a list of problems */
export async function loadConfig(root, slug) {
  const file = join(gameDir(root, slug), "check-board.config.mjs")
  const shown = file.slice(root.length + 1)
  if (!existsSync(file)) return { file: null, shown, config: {}, problems: [] }
  const config = (await import(pathToFileURL(file).href)).default
  if (!isObject(config)) return { file, shown, config: {}, problems: [`${shown} must export a config object as its default export`] }
  const problems = []
  const wrong = (key, wanted) => problems.push(`${shown}: \`${key}\` must be ${wanted}`)
  for (const key of Object.keys(config)) if (!(key in CONFIG_KEYS)) problems.push(`${shown}: "${key}" is not a key of the config (the keys are ${Object.keys(CONFIG_KEYS).join(", ")})`)
  if (config.players !== undefined && !(Array.isArray(config.players) && config.players.every(Number.isInteger))) wrong("players", "a list of whole numbers")
  if (config.sizes !== undefined && !(Array.isArray(config.sizes) && config.sizes.every((size) => typeof size === "string"))) wrong("sizes", "a list of \"WIDTHxHEIGHT\" texts")
  if (config.options !== undefined && !isObject(config.options)) wrong("options", "an object")
  if (config.bot !== undefined && typeof config.bot !== "function") wrong("bot", "a function")
  if (config.warm !== undefined && !Number.isInteger(config.warm)) wrong("warm", "a number of moves")
  if (config.scenes !== undefined && !(isObject(config.scenes) && Object.values(config.scenes).every((scene) => typeof scene === "function"))) wrong("scenes", "an object of functions `async (table) => {}`")
  if (config.presses !== undefined && !(isObject(config.presses) && typeof config.presses.plan === "function" && typeof config.presses.find === "function")) wrong("presses", "an object with a `plan` and a `find`, both functions")
  if (config.scenarios !== undefined && !(isObject(config.scenarios) && Object.values(config.scenarios).every((scenario) => typeof scenario === "function" || typeof scenario?.run === "function"))) wrong("scenarios", "an object of functions or `{ run }` objects")
  if (config.ignoreConsole !== undefined && !Array.isArray(config.ignoreConsole)) wrong("ignoreConsole", "a list of RegExps or texts")
  return { file, shown, config, problems }
}
